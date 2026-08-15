import { describe, expect, it } from "vitest";

import {
  canonicalShortAnswerToSlots,
  createEmptyShortAnswerSlots,
  isValidCanonicalShortAnswer,
  parseShortAnswerText,
  shortAnswerSlotsToCanonicalValue,
  shortAnswerSlotsToDisplayValue,
} from "@/lib/exam/short-answer";
import type { ShortAnswerSlots } from "@/types/exam";

describe("short-answer slots", () => {
  it.each<{
    slots: ShortAnswerSlots;
    display: string;
    canonical: string;
  }>([
    { slots: ["1", "9", null, null], display: "19", canonical: "19" },
    { slots: ["0", ",", "2", "1"], display: "0,21", canonical: "0.21" },
    { slots: ["-", "0", ",", "5"], display: "-0,5", canonical: "-0.5" },
    { slots: ["1", "2", ",", "3"], display: "12,3", canonical: "12.3" },
  ])("converts $display to $canonical", ({ slots, display, canonical }) => {
    expect(shortAnswerSlotsToDisplayValue(slots)).toBe(display);
    expect(shortAnswerSlotsToCanonicalValue(slots)).toBe(canonical);
    expect(canonicalShortAnswerToSlots(canonical)).toEqual(slots);
  });

  it.each<{ slots: ShortAnswerSlots }>([
    { slots: ["-", ",", "5", null] },
    { slots: ["1", "2", ",", null] },
    { slots: ["1", null, "2", null] },
    { slots: ["1", "-", "2", null] },
    { slots: ["-", "-", "-", "-"] },
  ])("rejects invalid slot pattern $slots", ({ slots }) => {
    expect(shortAnswerSlotsToCanonicalValue(slots)).toBeNull();
  });

  it.each(["19", "0.21", "-0.5", "12.3", "1234", "-123"])(
    "accepts canonical value %s",
    (value) => {
      expect(isValidCanonicalShortAnswer(value)).toBe(true);
    },
  );

  it.each(["-.5", "12.", "1..2", "1-2", "1.2.3", "1 2", "----"])(
    "rejects canonical value %s",
    (value) => {
      expect(isValidCanonicalShortAnswer(value)).toBe(false);
    },
  );

  it.each<{ text: string; slots: ShortAnswerSlots }>([
    { text: "19", slots: ["1", "9", null, null] },
    { text: "0,21", slots: ["0", ",", "2", "1"] },
    { text: "-0,5", slots: ["-", "0", ",", "5"] },
    { text: "12,3", slots: ["1", "2", ",", "3"] },
    { text: "1234", slots: ["1", "2", "3", "4"] },
    { text: "-123", slots: ["-", "1", "2", "3"] },
  ])("parses Vietnamese text $text into four slots", ({ text, slots }) => {
    expect(parseShortAnswerText(text)).toEqual(slots);
  });

  it.each(["12345", "123,45", "1/2", "sqrt(2)", "2π", "1e3", "1+2", "0.21"])(
    "rejects free-form or too-long text %s",
    (text) => {
      expect(parseShortAnswerText(text)).toBeNull();
    },
  );

  it("maps empty text to the existing empty slot representation", () => {
    expect(parseShortAnswerText("")).toEqual(createEmptyShortAnswerSlots());
  });
});
