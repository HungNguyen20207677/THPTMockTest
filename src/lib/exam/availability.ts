import { EXAM_AVAILABILITY_STATE, EXAM_TIME_ZONE } from "@/lib/constants/exam";
import type { ExamAvailabilityState } from "@/types/exam";

const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function getExamAvailabilityState(
  availableFrom: Date | string | null | undefined,
  availableUntil: Date | string | null | undefined,
  now: Date,
): ExamAvailabilityState {
  if (availableFrom && now.getTime() < new Date(availableFrom).getTime()) {
    return EXAM_AVAILABILITY_STATE.UPCOMING;
  }

  if (availableUntil && now.getTime() >= new Date(availableUntil).getTime()) {
    return EXAM_AVAILABILITY_STATE.CLOSED;
  }

  return availableFrom || availableUntil
    ? EXAM_AVAILABILITY_STATE.OPEN
    : EXAM_AVAILABILITY_STATE.UNRESTRICTED;
}

export function utcToVietnamDateTimeLocal(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    return "";
  }

  const local = new Date(instant.getTime() + VIETNAM_UTC_OFFSET_MS);
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

export function vietnamDateTimeLocalToUtc(value: string): string | null {
  if (value === "") {
    return null;
  }

  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error("Thời gian không hợp lệ.");
  }

  const [, year, month, day, hour, minute] = match;
  const instant = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ) - VIETNAM_UTC_OFFSET_MS,
  );

  if (utcToVietnamDateTimeLocal(instant.toISOString()) !== value) {
    throw new Error("Thời gian không hợp lệ.");
  }

  return instant.toISOString();
}

export const examAvailabilityDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: EXAM_TIME_ZONE,
});
