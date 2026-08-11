import { describe, expect, it, vi } from "vitest";

import {
  formatCountdown,
  getServerSynchronizedRemainingMilliseconds,
} from "@/components/exam/countdown-timer";

describe("countdown synchronization", () => {
  it("derives remaining time from serverNow and monotonic elapsed time", () => {
    const wallClockSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2099-01-01T00:00:00.000Z").getTime());

    const remaining = getServerSynchronizedRemainingMilliseconds(
      "2026-08-11T04:30:00.000Z",
      "2026-08-11T03:00:00.000Z",
      1500,
    );

    expect(remaining).toBe(90 * 60 * 1000 - 1500);
    expect(formatCountdown(remaining)).toBe("01:29:59");
    expect(wallClockSpy).not.toHaveBeenCalled();
    wallClockSpy.mockRestore();
  });
});
