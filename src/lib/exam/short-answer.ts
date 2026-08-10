import {
  EXAM_STRUCTURE,
  SHORT_ANSWER_SLOT_OPTIONS,
} from "@/lib/constants/exam";
import type {
  ShortAnswerSlot,
  ShortAnswerSlotOption,
  ShortAnswerSlots,
} from "@/types/exam";

const shortAnswerOptionSet = new Set<string>(SHORT_ANSWER_SLOT_OPTIONS);
const canonicalShortAnswerPattern = /^-?\d+(?:\.\d+)?$/;

export function createEmptyShortAnswerSlots(): ShortAnswerSlots {
  return [null, null, null, null];
}

export function isShortAnswerSlotOption(
  value: unknown,
): value is ShortAnswerSlotOption {
  return typeof value === "string" && shortAnswerOptionSet.has(value);
}

export function isValidCanonicalShortAnswer(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= EXAM_STRUCTURE.shortAnswerSlots &&
    canonicalShortAnswerPattern.test(value)
  );
}

function getOccupiedSlots(slots: readonly ShortAnswerSlot[]): string[] | null {
  if (slots.length !== EXAM_STRUCTURE.shortAnswerSlots) {
    return null;
  }

  const firstEmptyIndex = slots.findIndex((slot) => slot === null);
  const occupiedLength =
    firstEmptyIndex === -1 ? slots.length : firstEmptyIndex;

  if (occupiedLength === 0) {
    return null;
  }

  if (slots.slice(occupiedLength).some((slot) => slot !== null)) {
    return null;
  }

  const occupiedSlots = slots.slice(0, occupiedLength);

  if (!occupiedSlots.every(isShortAnswerSlotOption)) {
    return null;
  }

  return occupiedSlots;
}

export function shortAnswerSlotsToDisplayValue(
  slots: readonly ShortAnswerSlot[],
): string | null {
  const occupiedSlots = getOccupiedSlots(slots);

  if (!occupiedSlots) {
    return null;
  }

  const displayValue = occupiedSlots.join("");
  const canonicalValue = displayValue.replace(",", ".");

  return isValidCanonicalShortAnswer(canonicalValue) ? displayValue : null;
}

export function shortAnswerSlotsToCanonicalValue(
  slots: readonly ShortAnswerSlot[],
): string | null {
  const displayValue = shortAnswerSlotsToDisplayValue(slots);
  return displayValue?.replace(",", ".") ?? null;
}

export function canonicalShortAnswerToSlots(
  canonicalValue: string,
): ShortAnswerSlots | null {
  if (!isValidCanonicalShortAnswer(canonicalValue)) {
    return null;
  }

  const displayCharacters = canonicalValue.replace(".", ",").split("");
  const slots = createEmptyShortAnswerSlots();

  for (const [index, character] of displayCharacters.entries()) {
    if (!isShortAnswerSlotOption(character)) {
      return null;
    }

    slots[index] = character;
  }

  return slots;
}
