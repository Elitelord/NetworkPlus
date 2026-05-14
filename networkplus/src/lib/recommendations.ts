import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { startOfDay, endOfDay } from "date-fns";
import { toneToPromptInstruction } from "@/lib/tone-presets";
import {
  scoreContactForRecommendation,
  type ContactForScore,
  type UserForScore,
} from "@/lib/recommendation-scoring";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function getOrCreateDailyRecommendation(userId: string) {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

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

  return generateDailyRecommendation(userId);
}

function buildUserIntentLines(user: UserForScore): string {
  const parts: string[] = [];
  if (user.industryField) parts.push(`Industry: ${user.industryField}`);
  if (user.primaryGoal) parts.push(`Primary goal: ${user.primaryGoal}`);
  if (user.useCase && user.useCase.toLowerCase() !== "both" && user.useCase.trim() !== "") {
    parts.push(`Use case: ${user.useCase} networking`);
  } else if (user.useCase?.toLowerCase() === "both") {
    parts.push("Use case: mix of personal and professional");
  }
  return parts.length ? parts.join("\n") : "No extra profile context.";
}

function criteriaLines(user: UserForScore): string {
  const uc = (user.useCase || "").toLowerCase();
  if (uc === "professional") {
    return "Prioritize professional (WORK) relationships when choosing, unless a personal contact has a much stronger timely reason to reach out.";
  }
  if (uc === "personal") {
    return "Prioritize friends and family when choosing, unless a work contact clearly needs attention.";
  }
  if (uc === "both") {
    return "Balance personal and professional contacts; pick whoever has the strongest reason to reconnect today.";
  }
  return "Choose the single best contact from the list using the criteria below.";
}

async function generateDailyRecommendation(userId: string) {
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      useCase: true,
      industryField: true,
      primaryGoal: true,
      communicationTone: true,
    },
  });

  const userForScore: UserForScore = {
    useCase: userRow?.useCase ?? null,
    industryField: userRow?.industryField ?? null,
    primaryGoal: userRow?.primaryGoal ?? null,
  };

  const pool = await prisma.contact.findMany({
    where: { ownerId: userId },
    orderBy: [
      { strengthScore: "asc" },
      { lastInteractionAt: "asc" },
    ],
    take: 50,
    include: {
      interactions: {
        orderBy: { date: "desc" },
        take: 3,
      },
    },
  });

  if (pool.length === 0) {
    return null;
  }

  const scored = pool
    .map((c) => {
      const contact: ContactForScore = {
        category: c.category,
        strengthScore: c.strengthScore,
        lastInteractionAt: c.lastInteractionAt,
        createdAt: c.createdAt,
        description: c.description,
        groups: c.groups || [],
        profile: c.profile,
      };
      return { contact: c, score: scoreContactForRecommendation(contact, userForScore) };
    })
    .sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, 10).map((s) => s.contact);

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const contactsContext = candidates.map((c, i) => {
    const lastInteraction = c.interactions[0];
    return `[${i}] Name: ${c.name}
Category: ${c.category}
Description: ${c.description || "N/A"}
Bio: ${(c.metadata as any)?.inferredBio || "N/A"}
Last Interaction: ${lastInteraction ? lastInteraction.date.toLocaleDateString() : "Never"}
Interaction Context: ${lastInteraction?.content || "N/A"}`;
  }).join("\n\n");

  const toneLine = toneToPromptInstruction(userRow?.communicationTone ?? null);
  const userIntent = buildUserIntentLines(userForScore);
  const criteria = criteriaLines(userForScore);

  const prompt = `
    You are a networking coach assistant for NetworkPlus.
    Your task is to select the SINGLE best person for the user to reach out to today from the following list.

    USER CONTEXT:
    ${userIntent}

    SELECTION CRITERIA:
    ${criteria}

    COMMUNICATION TONE FOR ICEBREAKER:
    ${toneLine}

    CANDIDATES:
    ${contactsContext}

    CRITERIA for choosing:
    - Prioritize people with a clear recent "hook" (e.g., job change, anniversary, or a topic you discussed recently).
    - Prioritize important connections (high quality bio/description) that are becoming distant.

    OUTPUT FORMAT (JSON ONLY):
    {
      "selectedIndex": number,
      "reason": "One concise sentence on WHY they should reach out today.",
      "icebreaker": "One short opening line or question based on their history/bio, matching the communication tone instructions."
    }

    Example Reason: "It's been 4 months since you discussed SaaS trends with Sarah; her latest role transition makes this a great time to sync."
    Example Icebreaker: "Hey Sarah! Saw you recently started the new position—huge congrats. How's the first month treating you?"

    Rules:
    1. Return ONLY valid JSON.
    2. Be extremely concise.
    3. Ensure the selectedIndex is a valid index from the candidates list (0 to ${candidates.length - 1}).
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const data = JSON.parse(responseText);

    const selectedContact = candidates[data.selectedIndex];
    if (!selectedContact) throw new Error("Invalid selection index from AI");

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
