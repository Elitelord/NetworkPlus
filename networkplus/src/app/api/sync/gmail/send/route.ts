import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getValidGoogleAccessToken } from "@/lib/calendar-utils";
import { inferPlatformFromEvent } from "@/lib/calendar-utils";

export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    const contactId = data.contactId ?? (Array.isArray(data.contactIds) && data.contactIds.length > 0 ? data.contactIds[0] : undefined);
    const { subject, body: emailBody } = data;

    if (!contactId || !subject || !emailBody) {
      return NextResponse.json({ error: "Missing required fields (contactId or contactIds, subject, body)" }, { status: 400 });
    }

    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "google" },
    });

    if (!account) {
        return NextResponse.json(
            { error: "Sign in with Google to send emails from here." },
            { status: 400 }
        );
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ownerId: session.user.id }
    });

    if (!contact || !contact.email) {
      return NextResponse.json({ error: "Contact not found or missing email" }, { status: 404 });
    }

    const accessToken = await getValidGoogleAccessToken(account, prisma);
    if (!accessToken) {
        return NextResponse.json(
            { error: "Your Google sign-in has expired. Please sign in again to continue." },
            { status: 401 }
        );
    }

    // Construct raw email
    const emailLines = [
      `To: ${contact.email}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      emailBody,
    ];
    const emailRaw = emailLines.join("\r\n");
    const encodedEmail = Buffer.from(emailRaw).toString("base64").replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Send email via Gmail API
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gmail send error:", err);
      return NextResponse.json({ error: "Failed to send email. You may need to sign back in with the updated permissions." }, { status: res.status });
    }

    // Log the interaction
    await prisma.interaction.create({
      data: {
          type: "Email Sent",
          platform: "EMAIL",
          date: new Date(),
          content: subject,
          metadata: { body: emailBody?.slice(0, 500) },
          contacts: {
              connect: [{ id: contact.id }],
          },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Send email error:", error);
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
  }
}
