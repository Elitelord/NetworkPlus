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
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    const node = await prisma.node.create({
      data: { title, description, metadata, ownerId },
    });
    return NextResponse.json(node, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, title, description, metadata, ownerId } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (metadata !== undefined) data.metadata = metadata;
    if (ownerId !== undefined) data.ownerId = ownerId;

    const updated = await prisma.node.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Node not found" }, { status: 404 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    // remove dependent links first to avoid FK constraint errors
    await prisma.link.deleteMany({ where: { OR: [{ fromId: id }, { toId: id }] } });
    const deleted = await prisma.node.delete({ where: { id } });
    return NextResponse.json(deleted);
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Node not found" }, { status: 404 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
