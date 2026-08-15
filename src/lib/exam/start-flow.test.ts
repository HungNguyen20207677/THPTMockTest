import { describe, expect, it, vi } from "vitest";

import { createConfirmedExamStart } from "@/lib/exam/start-flow";

describe("confirmed exam start flow", () => {
  it("does not request fullscreen or start the attempt before confirmation", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(true);
    const startAttempt = vi.fn().mockResolvedValue("attempt-id");
    const confirm = createConfirmedExamStart({
      wasDocumentFullscreen: false,
      requestFullscreen,
      startAttempt,
      exitFullscreen: vi.fn().mockResolvedValue(true),
    });

    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(startAttempt).not.toHaveBeenCalled();

    await expect(confirm()).resolves.toBe("attempt-id");
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(startAttempt).toHaveBeenCalledOnce();
    expect(requestFullscreen.mock.invocationCallOrder[0]).toBeLessThan(
      startAttempt.mock.invocationCallOrder[0],
    );
  });

  it("leaves newly entered fullscreen when attempt creation fails", async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(true);
    const confirm = createConfirmedExamStart({
      wasDocumentFullscreen: false,
      requestFullscreen: vi.fn().mockResolvedValue(true),
      startAttempt: vi.fn().mockRejectedValue(new Error("Start failed")),
      exitFullscreen,
    });

    await expect(confirm()).rejects.toThrow("Start failed");
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });
});
