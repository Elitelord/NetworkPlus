import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateDailyRecommendation } from "@/lib/recommendations";

export async function GET() {
  try {
    const session = await (auth as any)();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recommendation = await getOrCreateDailyRecommendation(session.user.id);
    
    if (!recommendation) {
      return NextResponse.json({ message: "No contacts found for recommendation." }, { status: 200 });
    }

    return NextResponse.json(recommendation);
  } catch (err) {
    console.error("[Recommendations API] Failed:", err);
    return NextResponse.json({ error: "Failed to fetch recommendation" }, { status: 500 });
  }
}
