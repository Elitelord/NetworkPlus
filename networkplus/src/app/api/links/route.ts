import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import prisma from "@lib/prisma";

import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth() as Session | null;
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const links = await prisma.link.findMany({
      where: {
        OR: [
          { from: { ownerId: session.user.id } },
          { to: { ownerId: session.user.id } }
        ]
      }
    });
    return NextResponse.json(links);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { fromId, toId, label } = body;

    // Validate that contacts exist AND belong to user
    const c1 = await prisma.contact.findFirst({ where: { id: fromId, ownerId: session.user.id } });
    const c2 = await prisma.contact.findFirst({ where: { id: toId, ownerId: session.user.id } });

    if (!c1 || !c2) {
      return NextResponse.json({ error: "Source or target contact not found or unauthorized" }, { status: 400 });
    }

    // Cleanup: If an inferred link exists between these two, delete it so the manual one takes precedence
    await prisma.link.deleteMany({
      where: {
        OR: [
          { fromId: fromId, toId: toId },
          { fromId: toId, toId: fromId },
        ],
        metadata: {
          path: ["source"],
          equals: "inferred"
        }
      }
    });

    const link = await prisma.link.create({
      data: {
        fromId,
        toId,
        label,
      },
    });
    return NextResponse.json(link);
  } catch (err) {
    console.error("Create link failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
