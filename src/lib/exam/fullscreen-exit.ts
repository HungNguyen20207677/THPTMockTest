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
  suppressExit = false,
): {
  state: ExamFullscreenTrackingState;
  shouldHandleExit: boolean;
} {
  const exitedFullscreen =
    current.wasFullscreen &&
    current.hasEnteredFullscreen &&
    !current.exitHandled &&
    !isFullscreen;
  const shouldHandleExit = exitedFullscreen && !suppressExit;

  return {
    state: {
      wasFullscreen: isFullscreen,
      hasEnteredFullscreen: current.hasEnteredFullscreen || isFullscreen,
      exitHandled: current.exitHandled || shouldHandleExit,
    },
    shouldHandleExit,
  };
}
