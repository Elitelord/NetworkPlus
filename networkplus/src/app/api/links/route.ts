import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import prisma from "@lib/prisma";
import { auth } from "@/auth";
import { parseJsonBody, apiError } from "@/lib/api-utils";

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
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data as { fromId?: unknown; toId?: unknown; label?: unknown };
    const { fromId, toId, label } = body;

    if (typeof fromId !== "string" || !fromId.trim() || typeof toId !== "string" || !toId.trim()) {
      return NextResponse.json({ error: "Valid fromId and toId are required" }, { status: 400 });
    }
    if (fromId === toId) {
      return NextResponse.json({ error: "fromId and toId must be different" }, { status: 400 });
    }
    const trimmedLabel = typeof label === "string" ? label.trim() : undefined;
    if (trimmedLabel !== undefined && trimmedLabel.length > 500) {
      return NextResponse.json({ error: "Label must be 500 characters or less" }, { status: 400 });
    }

    const [c1, c2] = await Promise.all([
      prisma.contact.findFirst({ where: { id: fromId, ownerId: session.user.id }, select: { id: true } }),
      prisma.contact.findFirst({ where: { id: toId, ownerId: session.user.id }, select: { id: true } }),
    ]);

    if (!c1 || !c2) {
      return NextResponse.json({ error: "Source or target contact not found or unauthorized" }, { status: 400 });
    }

    const link = await prisma.link.create({
      data: {
        fromId: fromId.trim(),
        toId: toId.trim(),
        label: trimmedLabel || null,
      },
    });
    return NextResponse.json(link);
  } catch (err) {
    console.error("Create link failed:", err);
    return apiError(err);
  }
}
