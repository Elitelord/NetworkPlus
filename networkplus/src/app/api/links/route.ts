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
