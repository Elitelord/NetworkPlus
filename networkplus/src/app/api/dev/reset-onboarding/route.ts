import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth() as any;
  
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized. You must be logged in to reset your state.", { status: 401 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        hasCompletedOnboarding: false,
        hasCompletedTour: false,
        useCase: null,
        industryField: null,
        primaryGoal: null
      },
    });

    // Extract the origin to redirect correctly
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    return NextResponse.redirect(`${baseUrl}/onboarding`);
  } catch (error) {
    console.error("Failed to reset onboarding", error);
    return new NextResponse("Failed to reset", { status: 500 });
  }
}
