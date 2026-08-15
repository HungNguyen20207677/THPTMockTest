"use client";

import { useId, useState, type Ref } from "react";

import { Input } from "@/components/ui/input";
import {
  parseShortAnswerText,
  shortAnswerSlotsToDisplayValue,
} from "@/lib/exam/short-answer";
import type { ShortAnswerSlots } from "@/types/exam";

interface ShortAnswerTextInputProps {
  value: ShortAnswerSlots;
  onChange: (value: ShortAnswerSlots) => void;
  label: string;
  error?: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: () => void;
  onValidityChange?: (isValid: boolean) => void;
}

function getValidationError(text: string): string | null {
  if (text === "" || parseShortAnswerText(text)) {
    return null;
  }

  return text.length > 4
    ? "Đáp án không được vượt quá 4 ký tự."
    : "Chỉ nhập chữ số, có thể có dấu âm ở đầu và một dấu phẩy thập phân.";
}

export function ShortAnswerTextInput({
  value,
  onChange,
  label,
  error,
  disabled = false,
  inputRef,
  onBlur,
  onValidityChange,
}: ShortAnswerTextInputProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const helpId = `${generatedId}-help`;
  const statusId = `${generatedId}-status`;
  const errorId = `${generatedId}-error`;
  const displayValue = shortAnswerSlotsToDisplayValue(value) ?? "";
  const [draftText, setDraftText] = useState<string | null>(null);
  const text = draftText ?? displayValue;
  const localError = getValidationError(text);
  const validationError = localError ?? error;
  const status = localError
    ? "Đáp án chưa hợp lệ"
    : text
      ? `Đáp án đã nhập: ${text}`
      : "Chưa trả lời";

  return (
    <fieldset className="border-border space-y-3 rounded-lg border p-3">
      <legend className="px-1 font-medium">{label}</legend>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium">
          Đáp án
        </label>
        <span id={statusId} className="text-muted-foreground text-sm">
          {status}
        </span>
      </div>
      <Input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={text}
        disabled={disabled}
        placeholder="Ví dụ: -0,5"
        aria-invalid={Boolean(validationError)}
        aria-describedby={`${helpId} ${statusId}${validationError ? ` ${errorId}` : ""}`}
        onBlur={onBlur}
        onChange={(event) => {
          const nextText = event.target.value;
          const slots = parseShortAnswerText(nextText);
          setDraftText(slots ? null : nextText);
          onValidityChange?.(slots !== null);

          if (slots) {
            onChange(slots);
          }
        }}
      />
      <p id={helpId} className="text-muted-foreground text-xs leading-5">
        Nhập tối đa 4 ký tự. Dùng dấu phẩy cho phần thập phân, ví dụ 19, 0,21
        hoặc -0,5.
      </p>
      {validationError && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {validationError}
        </p>
      )}
    </fieldset>
  );
}
