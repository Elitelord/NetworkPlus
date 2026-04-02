import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { startOfDay, endOfDay } from "date-fns";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function getOrCreateDailyRecommendation(userId: string) {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  // 1. Check for existing recommendation for today
  const existing = await (prisma as any).recommendation.findFirst({
    where: {
      userId,
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    include: {
      contact: true,
    },
  });

  if (existing) {
    return existing;
  }

  // 2. No recommendation yet, generate one
  return generateDailyRecommendation(userId);
}

async function generateDailyRecommendation(userId: string) {
  // Fetch a pool of candidates: 
  // - Overdue contacts (low strength score)
  // - High value contacts we haven't spoken to in a while
  // For simplicity, we'll take the top 10 "due soon" contacts
  const candidates = await prisma.contact.findMany({
    where: {
      ownerId: userId,
    },
    orderBy: [
      { strengthScore: "asc" }, // Weakest first
      { lastInteractionAt: "asc" }, // Most dusty first
    ],
    take: 10,
    include: {
      interactions: {
        orderBy: { date: "desc" },
        take: 3,
      },
    },
  });

  if (candidates.length === 0) {
    return null;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const contactsContext = candidates.map((c, i) => {
    const lastInteraction = c.interactions[0];
    return `[${i}] Name: ${c.name}
Description: ${c.description || "N/A"}
Bio: ${(c.metadata as any)?.inferredBio || "N/A"}
Last Interaction: ${lastInteraction ? lastInteraction.date.toLocaleDateString() : "Never"}
Interaction Context: ${lastInteraction?.content || "N/A"}`;
  }).join("\n\n");

  const prompt = `
    You are a networking coach assistant for NetworkPlus.
    Your task is to select the SINGLE best person for the user to reach out to today from the following list.
    
    CANDIDATES:
    ${contactsContext}
    
    CRITERIA for choosing:
    - Prioritize people with a clear recent "hook" (e.g., job change, anniversary, or a topic you discussed recently).
    - Prioritize important connections (high quality bio/description) that are becoming distant.
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "selectedIndex": number,
      "reason": "One concise sentence on WHY they should reach out today.",
      "icebreaker": "One short, friendly opening line or question based on their history/bio."
    }
    
    Example Reason: "It's been 4 months since you discussed SaaS trends with Sarah; her latest role transition makes this a great time to sync."
    Example Icebreaker: "Hey Sarah! Saw you recently started the new position—huge congrats. How's the first month treating you?"
    
    Rules:
    1. Return ONLY valid JSON.
    2. Be extremely concise.
    3. Ensure the selectedIndex is a valid index from the candidates list.
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const data = JSON.parse(responseText);

    const selectedContact = candidates[data.selectedIndex];
    if (!selectedContact) throw new Error("Invalid selection index from AI");

    // Save the recommendation
    return await (prisma as any).recommendation.create({
      data: {
        userId,
        contactId: selectedContact.id,
        reason: data.reason,
        icebreaker: data.icebreaker,
        date: new Date(),
      },
      include: {
        contact: true,
      },
    });
  } catch (error) {
    console.error("[Recommendations] Generation failed:", error);
    
    // Fallback: Just pick the first one without fancy AI reasoning if it fails
    const fallback = candidates[0];
    return await (prisma as any).recommendation.create({
      data: {
        userId,
        contactId: fallback.id,
        reason: `You haven't connected with ${fallback.name} in a while. Time to catch up!`,
        icebreaker: `Hi ${fallback.name}, hope you're doing well! Would love to catch up soon.`,
        date: new Date(),
      },
      include: {
        contact: true,
      },
    });
  }
}
