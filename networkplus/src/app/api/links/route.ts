import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const links = await prisma.link.findMany({ include: { from: true, to: true } });
    return NextResponse.json(links);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fromId, toId, label, weight, metadata } = body;
    // basic validation
    if (!fromId || !toId) return NextResponse.json({ error: "fromId and toId required" }, { status: 400 });
    const link = await prisma.link.create({
      data: { fromId, toId, label, weight, metadata },
    });
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, fromId, toId, label, weight, metadata } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const data: any = {};
    if (fromId !== undefined) data.fromId = fromId;
    if (toId !== undefined) data.toId = toId;
    if (label !== undefined) data.label = label;
    if (weight !== undefined) data.weight = weight;
    if (metadata !== undefined) data.metadata = metadata;

    const updated = await prisma.link.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Link not found" }, { status: 404 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const deleted = await prisma.link.delete({ where: { id } });
    return NextResponse.json(deleted);
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Link not found" }, { status: 404 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
