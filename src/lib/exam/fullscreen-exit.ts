export interface ExamFullscreenTrackingState {
  wasFullscreen: boolean;
  hasEnteredFullscreen: boolean;
  exitHandled: boolean;
}

export function createExamFullscreenTrackingState(
  isFullscreen = false,
): ExamFullscreenTrackingState {
  return {
    wasFullscreen: isFullscreen,
    hasEnteredFullscreen: isFullscreen,
    exitHandled: false,
  };
}

export function advanceExamFullscreenTracking(
  current: ExamFullscreenTrackingState,
  isFullscreen: boolean,
): {
  state: ExamFullscreenTrackingState;
  shouldSubmit: boolean;
} {
  const shouldSubmit =
    current.wasFullscreen &&
    current.hasEnteredFullscreen &&
    !current.exitHandled &&
    !isFullscreen;

  return {
    state: {
      wasFullscreen: isFullscreen,
      hasEnteredFullscreen: current.hasEnteredFullscreen || isFullscreen,
      exitHandled: current.exitHandled || shouldSubmit,
    },
    shouldSubmit,
  };
}
