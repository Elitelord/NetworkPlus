import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const node = await prisma.node.findUnique({
      where: { id },
      include: { outgoing: true, incoming: true },
    });
    if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(node);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { title, description, metadata } = body;
    const node = await prisma.node.update({
      where: { id },
      data: { title, description, metadata },
    });
    return NextResponse.json(node);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    // remove links that reference this node first to avoid FK errors
    await prisma.link.deleteMany({ where: { OR: [{ fromId: id }, { toId: id }] } });
    await prisma.node.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
