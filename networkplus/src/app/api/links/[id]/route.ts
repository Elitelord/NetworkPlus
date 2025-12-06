import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const link = await prisma.link.findUnique({ where: { id }, include: { from: true, to: true } });
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(link);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { label, weight, metadata } = body;
    const link = await prisma.link.update({ where: { id }, data: { label, weight, metadata } });
    return NextResponse.json(link);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.link.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
