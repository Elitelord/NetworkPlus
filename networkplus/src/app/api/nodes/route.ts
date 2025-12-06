import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const nodes = await prisma.node.findMany({
      include: { outgoing: true, incoming: true },
    });
    return NextResponse.json(nodes);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, metadata, ownerId } = body;
    const node = await prisma.node.create({
      data: { title, description, metadata, ownerId },
    });
    return NextResponse.json(node, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
