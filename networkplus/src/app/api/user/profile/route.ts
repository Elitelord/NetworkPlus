import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!(session as any)?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await (prisma.user as any).findUnique({
    where: { id: (session as any).user.id },
    select: {
      groups: true,
      groupTypeOverrides: true,
      inferenceIncludePriorAffiliations: true,
    },
  });

  return NextResponse.json(user);
}
