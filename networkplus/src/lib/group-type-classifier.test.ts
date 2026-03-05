import { describe, it, expect } from "vitest";
import {
    classifyGroupType,
    classifyGroups,
    groupsByType,
    GROUP_TYPE_LABELS,
    type GroupType,
} from "./group-type-classifier";

describe("classifyGroupType", () => {
    // ── School ───────────────────────────────────────────────────────────
    it.each([
        ["Stanford University", "school"],
        ["MIT", "other"],  // No keyword match — just an abbreviation
        ["Harvard Alumni", "school"],
        ["Class of 2024", "school"],
        ["class of '22", "school"],
        ["'21 Graduates", "school"],
        ["Westfield High School", "school"],
        ["Academy of Arts", "school"],
        ["Data Science Institute", "school"],
        ["Elementary School Friends", "school"],
        ["MBA Cohort", "school"],
    ] as [string, GroupType][])(
        "classifies %s as %s",
        (name, expected) => {
            expect(classifyGroupType(name)).toBe(expected);
        }
    );

    // ── Employment ───────────────────────────────────────────────────────
    it.each([
        ["Google Inc", "employment"],
        ["Amazon Corp", "employment"],
        ["Acme LLC", "employment"],
        ["McKinsey Consulting", "employment"],
        ["Stripe Engineering", "employment"],
        ["Summer Internship 2023", "employment"],
        ["Apple Technologies", "employment"],
        ["Design Studio X", "employment"],
        ["BigCo Enterprises", "employment"],
        ["Deloitte Services", "employment"],
    ] as [string, GroupType][])(
        "classifies %s as %s",
        (name, expected) => {
            expect(classifyGroupType(name)).toBe(expected);
        }
    );

    // ── Social ───────────────────────────────────────────────────────────
    it.each([
        ["Friday Hangout", "social"],
        ["Gaming Crew", "social"],
        ["Book Club", "social"],
        ["Workout Buddies", "social"],
        ["Discord Server", "social"],
        ["Soccer League", "social"],
        ["College Friends", "school"],  // "college" keyword → school takes priority over "friends"
    ] as [string, GroupType][])(
        "classifies %s as %s",
        (name, expected) => {
            expect(classifyGroupType(name)).toBe(expected);
        }
    );

    // ── Family ───────────────────────────────────────────────────────────
    it.each([
        ["Family", "family"],
        ["Extended Family", "family"],
        ["Mom's Relatives", "family"],
        ["Cousins Group", "family"],
        ["In-Laws", "family"],
    ] as [string, GroupType][])(
        "classifies %s as %s",
        (name, expected) => {
            expect(classifyGroupType(name)).toBe(expected);
        }
    );

    // ── Community ────────────────────────────────────────────────────────
    it.each([
        ["St. Mary's Church", "community"],
        ["Local Mosque", "community"],
        ["Volunteer Network", "community"],
        ["Red Cross Charity", "community"],
        ["Habitat for Humanity", "community"],
        ["Neighborhood Watch", "community"],
        ["IEEE Society", "community"],
    ] as [string, GroupType][])(
        "classifies %s as %s",
        (name, expected) => {
            expect(classifyGroupType(name)).toBe(expected);
        }
    );

    // ── Other (fallback) ─────────────────────────────────────────────────
    it.each([
        ["Random Group", "other"],
        ["XYZ", "other"],
        ["", "other"],
        ["   ", "other"],
    ] as [string, GroupType][])(
        "classifies %s as %s",
        (name, expected) => {
            expect(classifyGroupType(name)).toBe(expected);
        }
    );

    // ── Priority ordering ────────────────────────────────────────────────
    it("prioritises family over social when both keywords match", () => {
        // "Family Friends" contains both "family" and "friends"
        expect(classifyGroupType("Family Friends")).toBe("family");
    });

    it("prioritises school over social when both keywords match", () => {
        // "University Club" → school wins over social "club"
        expect(classifyGroupType("University Club")).toBe("school");
    });

    it("is case insensitive", () => {
        expect(classifyGroupType("STANFORD UNIVERSITY")).toBe("school");
        expect(classifyGroupType("google inc")).toBe("employment");
    });
});

describe("classifyGroups", () => {
    it("returns a map of group name → type", () => {
        const result = classifyGroups(["Google Inc", "Stanford University", "Random"]);
        expect(result.get("Google Inc")).toBe("employment");
        expect(result.get("Stanford University")).toBe("school");
        expect(result.get("Random")).toBe("other");
    });

    it("handles empty array", () => {
        expect(classifyGroups([]).size).toBe(0);
    });
});

describe("groupsByType", () => {
    it("groups names by their classified type", () => {
        const result = groupsByType(["Google Inc", "Amazon Corp", "Stanford University", "Family"]);
        expect(result.get("employment")).toEqual(expect.arrayContaining(["Google Inc", "Amazon Corp"]));
        expect(result.get("school")).toEqual(["Stanford University"]);
        expect(result.get("family")).toEqual(["Family"]);
    });
});

describe("GROUP_TYPE_LABELS", () => {
    it("has a label for every type", () => {
        const types: GroupType[] = ["school", "employment", "social", "family", "community", "other"];
        for (const t of types) {
            expect(GROUP_TYPE_LABELS[t]).toBeTruthy();
        }
    });
});
