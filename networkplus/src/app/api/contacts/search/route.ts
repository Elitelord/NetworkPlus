import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(req: Request) {
  try {
    const session = await (auth as any)();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json([]);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    
    const prompt = `
      You are a database query assistant for a CRM called NetworkPlus.
      Translate the user's natural language search query into a Prisma "where" clause for the Contact model.
      
      CONTACT MODEL SCHEMA:
      - name: string
      - description: string?
      - groups: string[]
      - profile: JSON (contains currentCompany, currentTitle, city, school, etc.)
      - metadata: JSON (contains inferredBio: string)
      - strengthScore: Float
      - monthsKnown: Int

      GENERAL KEYWORD RULE:
      If the user provides a simple keyword or phrase (e.g., "Conference", "Engineer", "Google"), 
      you MUST generate an "OR" condition that searches across:
      - name (mode: 'insensitive')
      - description (mode: 'insensitive')
      - groups (hasSome)
      - metadata.inferredBio (path: ['inferredBio'], string_contains: value)

      PRISMA OPERATORS TIP:
      - Use "contains" with "mode: 'insensitive'" for fuzzy string matching.
      - Use "has" or "hasSome" for the "groups" array.
      - For JSON fields like profile, use { path: ['field'], equals: 'value' } or { path: ['field'], string_contains: 'value' }.
      - Use "inferredBio" inside the metadata field: { metadata: { path: ['inferredBio'], string_contains: 'value' } }.

      USER QUERY: "${query}"

      RULES:
      1. Return ONLY a valid JSON object representing the "where" clause.
      2. Always include ownerId: "${session.user.id}" to ensure security.
      3. Use "OR" for general keyword searches to ensure high recall.
      4. Do not include any explanation or markdown blocks. Just the JSON.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    console.log("[Magic Search] Raw AI Response:", text);
    
    let aiWhere;
    try {
      const jsonString = text.replace(/^```json/, '').replace(/```$/, '').trim();
      aiWhere = JSON.parse(jsonString);
    } catch (e) {
      console.warn("[Magic Search] AI parse failed, using fallback logic for AI part");
      aiWhere = { ownerId: session.user.id }; 
    }

    // Hybrid Search: AI + Direct Keyword
    const [aiResults, keywordResults] = await Promise.all([
      prisma.contact.findMany({
        where: aiWhere,
        take: 20,
        orderBy: { strengthScore: 'desc' }
      }),
      prisma.contact.findMany({
        where: {
          ownerId: session.user.id,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { groups: { hasSome: [query] } },
          ]
        },
        take: 20,
        orderBy: { strengthScore: 'desc' }
      })
    ]);

    // Merge and deduplicate
    const allResults = [...aiResults];
    const seenIds = new Set(aiResults.map(c => c.id));
    for (const contact of keywordResults) {
      if (!seenIds.has(contact.id)) {
        allResults.push(contact);
        seenIds.add(contact.id);
      }
    }

    console.log(`[Magic Search] AI found ${aiResults.length}, Keyword found ${keywordResults.length}. Total merged: ${allResults.length}`);
    return NextResponse.json(allResults.slice(0, 20));
  } catch (err) {
    console.error("Magic Search failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
