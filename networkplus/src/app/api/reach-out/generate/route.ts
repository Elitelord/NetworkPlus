import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { contactId, platform } = await req.json();

    if (!contactId || !platform) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ownerId: session.user.id },
      select: {
        name: true,
        description: true,
        groups: true,
        profile: true,
        strengthScore: true,
        monthsKnown: true,
        interactions: {
          orderBy: { date: "desc" },
          take: 5,
          select: {
            date: true,
            type: true,
            content: true,
          }
        },
        outgoing: {
          select: {
            to: {
              select: {
                id: true,
                name: true,
                strengthScore: true,
              }
            }
          }
        },
        incoming: {
          select: {
            from: {
              select: {
                id: true,
                name: true,
                strengthScore: true,
              }
            }
          }
        }
      },
    });

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { useCase: true, industryField: true, primaryGoal: true }
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Process network links to find top shared connections
    const connections = [
      ...contact.outgoing.map(l => l.to),
      ...contact.incoming.map(l => l.from)
    ].filter(c => c && c.id !== contactId);
    
    // Pick the connection with the highest strength score for social proof
    const topConnection = connections.sort((a, b) => (b.strengthScore || 0) - (a.strengthScore || 0))[0];

    // Build context parts
    const interactionHistory = contact.interactions.length > 0 
      ? contact.interactions.map(i => {
          const dateStr = new Date(i.date).toLocaleDateString();
          const content = i.content ? ` (Topic: ${i.content.slice(0, 200)}${i.content.length > 200 ? '...' : ''})` : "";
          return `- ${dateStr} [${i.type}]${content}`;
        }).join("\n")
      : "No recorded interaction history.";

    const profileData = contact.profile ? JSON.stringify(contact.profile) : "No detailed profile data.";
    
    // Relationship "Warmth" Strategy
    const isNewConnection = contact.monthsKnown < 3 || contact.strengthScore < 40;
    const relationshipType = isNewConnection ? "New connection / Lead" : "Established friend / Multi-year connection";
    
    const socialProof = topConnection 
      ? `Highest strength mutual contact is ${topConnection.name}. Mentioning this person provides social proof.`
      : "No shared connections recorded.";

    let userContextStr = "";
    if (dbUser) {
      const intentContext = [];
      if (dbUser.industryField) {
        intentContext.push(`in the ${dbUser.industryField} industry`);
      }
      if (dbUser.primaryGoal) {
        intentContext.push(`with a primary goal of ${dbUser.primaryGoal}`);
      }
      if (dbUser.useCase && dbUser.useCase.toLowerCase() !== "both" && dbUser.useCase.trim() !== "") {
        intentContext.push(`for ${dbUser.useCase} networking`);
      }
      if (intentContext.length > 0) {
        userContextStr = `USER INTENT/CONTEXT:\nYou are writing on behalf of a user who is ${intentContext.join(' and ')}. Frame your suggestion appropriately considering this goal and field.\n`;
      }
    }

    const prompt = `You are a helpful CRM personal assistant writing a ${platform === 'email' ? 'professional but friendly email' : 'short and casual check-in message'} to a contact named ${contact.name}. 

${userContextStr}
RELATIONSHIP CONTEXT:
- Type: ${relationshipType} (Strength Score: ${contact.strengthScore}/100, Months Known: ${contact.monthsKnown})
- Description: ${contact.description || 'No notes provided.'}
- Groups/Tags: ${(contact.groups && contact.groups.length > 0) ? contact.groups.join(', ') : 'None'}
- Profile Snippets: ${profileData}

SOCIAL PROOF:
- ${socialProof}

INTERACTION HISTORY (Most Recent First):
${interactionHistory}

TONE & STRATEGY:
${isNewConnection 
  ? "Since this is a NEW CONNECTION or LEAD, focus on building rapport and establishing a bridge using the shared connections if available. Be slightly more formal but warm."
  : "Since this is an ESTABLISHED FRIEND, use more casual, familiar language. Reference past interactions if they exist. Focus on genuine catching up."}

TASK:
Write a short, engaging message to check-in. Use the context naturally but briefly. DO NOT hallucinate details not provided above.

CRITICAL REQUIREMENT ON PLACEHOLDERS:
If you do not have enough information and MUST use a placeholder (e.g. for a company name, a project, or a specific date), you MUST format it in all caps with brackets, like [FILL IN: COMPANY] or [FILL IN: SPECIFIC PROJECT].
Additionally, if ANY placeholder is used, you MUST prefix the very beginning of the message with EXACTLY this string:
"⚠️ CAUTION: Please fill in the bracketed placeholders before sending! ⚠️\n\n"

Output your response as a raw JSON object string (no markdown formatting, no \`\`\`json blocks) with strictly this structure:
{
  "message": "The body of the message here",
  "subject": "The subject line here" // Only include if it's an email
}`;

    // Standardize on a reliable gemini model (1.5 Flash is best for speed/cost here)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Clean up potential markdown blocks if Gemini includes them
      const jsonString = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedResponse = JSON.parse(jsonString);

      return NextResponse.json(parsedResponse);
    } catch (genError: any) {
      console.error("Gemini specific error:", genError);
      throw genError;
    }
  } catch (error: any) {
    console.error("Generate message error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to generate message",
      isQuotaError: error.message?.includes("quota") || error.status === 429
    }, { status: 500 });
  }
}
