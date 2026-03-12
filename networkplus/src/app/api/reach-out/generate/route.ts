import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { contactId, platform } = await req.json();

    if (!contactId || !platform) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ownerId: session.user.id }
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const prompt = `You are a helpful assistant writing a ${platform === 'email' ? 'professional but friendly email' : 'short and casual check-in message'} to a contact named ${contact.name}. 
Their description/notes are: ${contact.description || 'No description provided.'}
Write a short, engaging message to check-in or catch up. 

Output your response as a raw JSON object string (no markdown formatting, no \`\`\`json blocks) with strictly this structure:
{
  "message": "The body of the message here",
  "subject": "The subject line here" // Only include if it's an email
}`;

    // Use gemini-flash-latest which should resolve the 404 error by pointing to the latest available flash model.
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Clean up potential markdown blocks if Gemini includes them
      const jsonString = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedResponse = JSON.parse(jsonString);

      return NextResponse.json(parsedResponse);
    } catch (genError: any) {
      console.error("Gemini specific error:", genError);
      // If gemini-1.5-flash fails, it might be a region or account issue, but 1.5-flash should generally be available.
      // We'll throw so it's caught by the outer block.
      throw genError;
    }
  } catch (error: any) {
    console.error("Generate message error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to generate message",
      isQuotaError: error.message?.includes("quota") || error.status === 429
    }, { status: 500 });
  }
}
