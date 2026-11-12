import { describe, expect, it } from "vitest";

import {
  getExamAvailabilityState,
  utcToVietnamDateTimeLocal,
  vietnamDateTimeLocalToUtc,
} from "@/lib/exam/availability";

describe("Exam availability", () => {
  it("converts Vietnam local date-time values to UTC without shifting on edit", () => {
    const utc = vietnamDateTimeLocalToUtc("2026-11-12T08:30");

    expect(utc).toBe("2026-11-12T01:30:00.000Z");
    expect(utcToVietnamDateTimeLocal(utc)).toBe("2026-11-12T08:30");
    expect(vietnamDateTimeLocalToUtc("")).toBeNull();
  });

  it.each(["2026-02-30T08:00", "2026-01-01T24:00", "not-a-date"])(
    "rejects invalid Vietnam local date-time value %s",
    (value) => {
      expect(() => vietnamDateTimeLocalToUtc(value)).toThrow(
        "Thời gian không hợp lệ.",
      );
    },
  );

  it("uses inclusive opening and exclusive closing boundaries", () => {
    const availableFrom = "2026-11-12T01:00:00.000Z";
    const availableUntil = "2026-11-12T02:00:00.000Z";

    expect(
      getExamAvailabilityState(
        availableFrom,
        availableUntil,
        new Date("2026-11-12T00:59:59.999Z"),
      ),
    ).toBe("UPCOMING");
    expect(
      getExamAvailabilityState(
        availableFrom,
        availableUntil,
        new Date(availableFrom),
      ),
    ).toBe("OPEN");
    expect(
      getExamAvailabilityState(
        availableFrom,
        availableUntil,
        new Date(availableUntil),
      ),
    ).toBe("CLOSED");
  });

  it("supports unrestricted, start-only, and end-only schedules", () => {
    const now = new Date("2026-11-12T01:00:00.000Z");

    expect(getExamAvailabilityState(null, null, now)).toBe("UNRESTRICTED");
    expect(
      getExamAvailabilityState("2026-11-12T00:00:00.000Z", null, now),
    ).toBe("OPEN");
    expect(
      getExamAvailabilityState(null, "2026-11-12T02:00:00.000Z", now),
    ).toBe("OPEN");
  });
});
