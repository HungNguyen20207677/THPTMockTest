"use client";

import { useId, type Ref } from "react";

import { Button } from "@/components/ui/button";
import { SHORT_ANSWER_SLOT_OPTIONS } from "@/lib/constants/exam";
import {
  isEmptyShortAnswerSlots,
  shortAnswerSlotsToDisplayValue,
} from "@/lib/exam/short-answer";
import { cn } from "@/lib/utils";
import type { ShortAnswerSlotOption, ShortAnswerSlots } from "@/types/exam";

interface ShortAnswerBubbleInputProps {
  value: ShortAnswerSlots;
  onChange: (value: ShortAnswerSlots) => void;
  label: string;
  error?: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: () => void;
}

function getOptionLabel(option: ShortAnswerSlotOption): string {
  if (option === "-") {
    return "dấu âm";
  }

  if (option === ",") {
    return "dấu phẩy";
  }

  return `số ${option}`;
}

export function ShortAnswerBubbleInput({
  value,
  onChange,
  label,
  error,
  disabled = false,
  inputRef,
  onBlur,
}: ShortAnswerBubbleInputProps) {
  const generatedId = useId();
  const errorId = `${generatedId}-error`;
  const statusId = `${generatedId}-status`;
  const displayValue = shortAnswerSlotsToDisplayValue(value);
  const isIncomplete =
    !displayValue && !isEmptyShortAnswerSlots(value) && !error;
  const answerStatus = displayValue
    ? `Đáp án đã chọn: ${displayValue}`
    : isEmptyShortAnswerSlots(value)
      ? "Chưa trả lời"
      : "Đáp án chưa hợp lệ";

  function updateSlot(index: number, option: ShortAnswerSlotOption) {
    const nextValue = [...value] as ShortAnswerSlots;
    nextValue[index] = option;
    onChange(nextValue);
  }

  function clearFromSlot(index: number) {
    const nextValue = [...value] as ShortAnswerSlots;

    for (let slotIndex = index; slotIndex < nextValue.length; slotIndex += 1) {
      nextValue[slotIndex] = null;
    }

    onChange(nextValue);
  }

  return (
    <fieldset
      className="border-border space-y-3 rounded-lg border p-3"
      aria-describedby={`${statusId}${error ? ` ${errorId}` : ""}`}
      aria-invalid={Boolean(error) || isIncomplete}
    >
      <legend className="px-1 font-medium">{label}</legend>
      <div className="flex justify-end">
        <span id={statusId} className="text-muted-foreground text-sm">
          {answerStatus}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {value.map((selectedOption, slotIndex) => {
          const precedingSlotIsEmpty =
            slotIndex > 0 && value[slotIndex - 1] === null;

          return (
            <fieldset
              key={slotIndex}
              className="bg-muted/40 rounded-md border p-2"
              disabled={disabled || precedingSlotIsEmpty}
            >
              <legend className="px-1 text-xs font-semibold">
                Ô {slotIndex + 1}
              </legend>
              <div className="grid grid-cols-4 gap-1.5">
                {SHORT_ANSWER_SLOT_OPTIONS.map((option, optionIndex) => {
                  const optionAlreadyUsed = value.some(
                    (slot, index) => index !== slotIndex && slot === option,
                  );
                  const hasDigitBefore = value
                    .slice(0, slotIndex)
                    .some(
                      (slot) => slot !== null && slot !== "-" && slot !== ",",
                    );
                  const optionDisabled =
                    (option === "-" && slotIndex !== 0) ||
                    (option === "," &&
                      (!hasDigitBefore ||
                        slotIndex === value.length - 1 ||
                        optionAlreadyUsed)) ||
                    (option === "-" && optionAlreadyUsed);

                  return (
                    <label
                      key={option}
                      className={cn(
                        "relative flex size-8 cursor-pointer items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                        selectedOption === option
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:border-primary",
                        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3",
                        optionDisabled &&
                          "cursor-not-allowed opacity-35 hover:border-input",
                      )}
                    >
                      <input
                        ref={
                          slotIndex === 0 && optionIndex === 0
                            ? inputRef
                            : undefined
                        }
                        type="radio"
                        className="sr-only"
                        name={`${generatedId}-${slotIndex}`}
                        value={option}
                        checked={selectedOption === option}
                        disabled={disabled || optionDisabled}
                        aria-label={`Ô ${slotIndex + 1}: ${getOptionLabel(option)}`}
                        onBlur={onBlur}
                        onChange={() => updateSlot(slotIndex, option)}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                disabled={disabled || selectedOption === null}
                onClick={() => clearFromSlot(slotIndex)}
              >
                Xóa từ ô này
              </Button>
            </fieldset>
          );
        })}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
