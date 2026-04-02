import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await (auth as any)();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await (prisma as any).recommendation.updateMany({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        dismissed: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Dismiss Recommendation API] Failed:", err);
    return NextResponse.json({ error: "Failed to dismiss recommendation" }, { status: 500 });
  }
}
