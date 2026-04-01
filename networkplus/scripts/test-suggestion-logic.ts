/**
 * Test script for AI Suggestion Enhancement Logic
 * 
 * Verifies:
 * 1. Tone categorization (Established Friend vs New Lead)
 * 2. Interaction history formatting
 * 3. Social proof selection (VIP Mutual)
 */

interface Interaction {
  date: string;
  type: string;
  content: string | null;
}

interface Connection {
  id: string;
  name: string;
  strengthScore: number;
}

interface ContactData {
  id: string;
  name: string;
  description: string | null;
  groups: string[];
  profile: any;
  strengthScore: number;
  monthsKnown: number;
  interactions: Interaction[];
  connections: Connection[];
}

function buildTestContext(contact: ContactData) {
  // Process network links to find top shared connections
  const topConnection = contact.connections.sort((a, b) => (b.strengthScore || 0) - (a.strengthScore || 0))[0];

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
    ? `Highest strength mutual contact is ${topConnection.name} (Score: ${topConnection.strengthScore}/100). Mentioning this person provides social proof.`
    : "No shared connections recorded.";

  return {
    relationshipType,
    socialProof,
    interactionHistory,
    isNewConnection,
    topConnection: topConnection?.name
  };
}

// ---------------------------------------------------------
// TEST CASES
// ---------------------------------------------------------

const CASE_FRIEND: ContactData = {
  id: "c1",
  name: "John Doe",
  description: "Old college roommate",
  groups: ["College", "Friends"],
  profile: { currentCompany: "Tech Corp", city: "NYC" },
  strengthScore: 85,
  monthsKnown: 120,
  interactions: [
    { date: "2024-03-15T12:00:00Z", type: "EMAIL", content: "Discussed the upcoming alumni event." }
  ],
  connections: [
    { id: "v1", name: "Alice", strengthScore: 90 }
  ]
};

const CASE_LEAD_WITH_PROOF: ContactData = {
  id: "c2",
  name: "Jane Smith",
  description: "Met at a conference last week",
  groups: ["Conference 2024"],
  profile: { currentCompany: "Innovate Inc" },
  strengthScore: 20,
  monthsKnown: 1,
  interactions: [],
  connections: [
    { id: "v1", name: "Alice", strengthScore: 90 }, // VIP
    { id: "v2", name: "Bob", strengthScore: 30 }
  ]
};

const CASE_LEAD_NO_PROOF: ContactData = {
  id: "c3",
  name: "Mystery Person",
  description: null,
  groups: [],
  profile: null,
  strengthScore: 5,
  monthsKnown: 0,
  interactions: [],
  connections: []
};

console.log("=== TESTING AI SUGGESTION LOGIC ===\n");

[CASE_FRIEND, CASE_LEAD_WITH_PROOF, CASE_LEAD_NO_PROOF].forEach((c, i) => {
  const ctx = buildTestContext(c);
  console.log(`CASE ${i + 1}: ${c.name}`);
  console.log(`- Type: ${ctx.relationshipType}`);
  console.log(`- Social Proof: ${ctx.socialProof}`);
  console.log(`- Interaction Summary: ${ctx.interactionHistory.split('\n')[0]}`);
  console.log(`- Strategy: ${ctx.isNewConnection ? "WARM LEAD / BRIDGE" : "CASUAL FRIEND / CATCH-UP"}`);
  console.log("\n-----------------------------------\n");
});
