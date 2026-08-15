export interface ExamFullscreenTrackingState {
  wasFullscreen: boolean;
  hasEnteredFullscreen: boolean;
  exitHandled: boolean;
}

export const EXAM_FULLSCREEN_EXIT_ACTION = {
  IGNORE: "IGNORE",
  REQUEST_CONFIRMATION: "REQUEST_CONFIRMATION",
  SUBMIT: "SUBMIT",
} as const;

export function resolveExamFullscreenExitAction({
  canFinalize,
  isConfirmedExit,
}: {
  canFinalize: boolean;
  isConfirmedExit: boolean;
}): (typeof EXAM_FULLSCREEN_EXIT_ACTION)[keyof typeof EXAM_FULLSCREEN_EXIT_ACTION] {
  if (!canFinalize) {
    return EXAM_FULLSCREEN_EXIT_ACTION.IGNORE;
  }

  return isConfirmedExit
    ? EXAM_FULLSCREEN_EXIT_ACTION.SUBMIT
    : EXAM_FULLSCREEN_EXIT_ACTION.REQUEST_CONFIRMATION;
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
  shouldHandleExit: boolean;
} {
  const shouldHandleExit =
    current.wasFullscreen &&
    current.hasEnteredFullscreen &&
    !current.exitHandled &&
    !isFullscreen;

  return {
    state: {
      wasFullscreen: isFullscreen,
      hasEnteredFullscreen: current.hasEnteredFullscreen || isFullscreen,
      exitHandled: current.exitHandled || shouldHandleExit,
    },
    shouldHandleExit,
  };
}
