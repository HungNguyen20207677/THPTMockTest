import { describe, expect, it } from "vitest";

import {
  advanceExamFullscreenTracking,
  createExamFullscreenTrackingState,
} from "@/lib/exam/fullscreen-exit";

describe("exam fullscreen exit tracking", () => {
  it("does not submit from an initial non-fullscreen state", () => {
    const transition = advanceExamFullscreenTracking(
      createExamFullscreenTrackingState(),
      false,
    );

    expect(transition.shouldSubmit).toBe(false);
  });

  it("does not submit when fullscreen entry never succeeded", () => {
    let state = createExamFullscreenTrackingState();
    state = advanceExamFullscreenTracking(state, false).state;
    const transition = advanceExamFullscreenTracking(state, false);

    expect(transition.shouldSubmit).toBe(false);
  });

  it("submits exactly once after a fullscreen to non-fullscreen transition", () => {
    let state = createExamFullscreenTrackingState();
    state = advanceExamFullscreenTracking(state, true).state;
    const exit = advanceExamFullscreenTracking(state, false);
    const duplicateExit = advanceExamFullscreenTracking(exit.state, false);

    expect(exit.shouldSubmit).toBe(true);
    expect(duplicateExit.shouldSubmit).toBe(false);
  });
});
