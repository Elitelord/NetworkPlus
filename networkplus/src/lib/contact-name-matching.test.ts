import { describe, it, expect } from "vitest";
import { textMentionsDistinctName } from "./contact-name-matching";

describe("textMentionsDistinctName", () => {
    it("matches full name as a phrase", () => {
        expect(textMentionsDistinctName("Coffee with Alex Smith", "alex smith")).toBe(true);
        expect(textMentionsDistinctName("Alex Smith — 1:1", "alex smith")).toBe(true);
    });

    it("does not match short name inside a longer word", () => {
        expect(textMentionsDistinctName("Samsung launch", "sam")).toBe(false);
        expect(textMentionsDistinctName("Christmas party", "chris")).toBe(false);
    });

    it("matches short name when bounded by non-letters", () => {
        expect(textMentionsDistinctName("Hi Sam — thanks", "sam")).toBe(true);
    });
});
