import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import prisma from "@lib/prisma";
import { auth } from "@/auth";
import { parseJsonBody, apiError } from "@/lib/api-utils";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth() as Session | null;
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data as { label?: unknown; weight?: unknown; metadata?: unknown };

    const current = await prisma.link.findUnique({
      where: { id },
      include: { from: { select: { ownerId: true } }, to: { select: { ownerId: true } } },
    });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (current.from.ownerId !== session.user.id || current.to.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Only allow updating label, weight, and metadata to prevent IDOR (client must not set fromId/toId)
    let newMetadata = body.metadata !== undefined ? body.metadata : (current?.metadata ?? {});
    if ((current?.metadata as any)?.source === "inferred") {
      const { source, ...rest } = (current?.metadata as any) || {};
      newMetadata = { ...rest, source: "manual" };
    }
    const data: { label?: string | null; weight?: number | null; metadata: object } = { metadata: newMetadata };
    if (body.label !== undefined) data.label = body.label;
    if (body.weight !== undefined) data.weight = body.weight;

    const link = await prisma.link.update({
      where: { id },
      data,
    });
    return NextResponse.json(link);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth() as Session | null;
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const link = await prisma.link.findUnique({
      where: { id },
      include: { from: { select: { ownerId: true, groups: true } }, to: { select: { ownerId: true, groups: true } } },
    });
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (link.from.ownerId !== session.user.id || link.to.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const meta = link.metadata as { rule?: string; group?: string } | null;
    const isInferred = meta?.rule === "shared_group" && typeof meta?.group === "string";
    const groupToRemove = meta?.group;

    if (isInferred && groupToRemove) {
      const fromGroups = (link.from.groups || []).filter((g) => g !== groupToRemove);
      const toGroups = (link.to.groups || []).filter((g) => g !== groupToRemove);
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: link.fromId },
          data: { groups: fromGroups },
        }),
        prisma.contact.update({
          where: { id: link.toId },
          data: { groups: toGroups },
        }),
      ]);
      const { updateInferredLinksBulk } = await import("@/lib/inference");
      await updateInferredLinksBulk([link.fromId, link.toId]);
      return NextResponse.json({ ok: true });
    }

    await prisma.link.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE link failed:", err);
    return apiError(err);
  }
}
