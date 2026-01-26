import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const links = await prisma.link.findMany();
    return NextResponse.json(links);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fromId, toId, label } = body;

    // Validate that contacts exist
    const c1 = await prisma.contact.findUnique({ where: { id: fromId } });
    const c2 = await prisma.contact.findUnique({ where: { id: toId } });

    if (!c1 || !c2) {
      return NextResponse.json({ error: "Source or target contact not found" }, { status: 400 });
    }

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
