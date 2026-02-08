
import { NextResponse } from "next/server";
import prisma from "@lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // If updating a link, we generally want to treat it as "manual" now, 
    // effectively locking it in if it was inferred.
    // We do this by removing the 'source: inferred' metadata or overwriting it.
    // Let's explicitly merge metadata to remove 'inferred' tag if we want it to survive inference cleanup.
    // OR: Just updating the label/weight.

    // Fetch current to check if inferred
    const current = await prisma.link.findUnique({ where: { id } });

    let newMetadata = body.metadata || current?.metadata || {};

    // If it was inferred, make it manual by removing the 'source' property or setting it to 'manual'
    if ((current?.metadata as any)?.source === 'inferred') {
      const { source, ...rest } = (current?.metadata as any) || {};
      newMetadata = { ...rest, source: 'manual' };
    }

    const link = await prisma.link.update({
      where: { id },
      data: {
        ...body,
        metadata: newMetadata
      },
    });
    return NextResponse.json(link);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.link.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
