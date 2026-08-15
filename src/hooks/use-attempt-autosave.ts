"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AttemptAnswers } from "@/types/exam-attempt";

const AUTOSAVE_DEBOUNCE_MS = 700;
const AUTOSAVE_RETRY_MS = 3000;

export const AUTOSAVE_STATUS = {
  SAVED: "SAVED",
  UNSAVED: "UNSAVED",
  SAVING: "SAVING",
  ERROR: "ERROR",
} as const;

export type AutosaveStatus =
  (typeof AUTOSAVE_STATUS)[keyof typeof AUTOSAVE_STATUS];

interface SaveAnswersResult {
  lastSavedAt?: string;
}

interface UseAttemptAutosaveOptions {
  answers: AttemptAnswers;
  initialAnswers: AttemptAnswers;
  initialLastSavedAt?: string;
  enabled: boolean;
  isPayloadValid: boolean;
  hasLocalDraft?: boolean;
  saveAnswers: (answers: AttemptAnswers) => Promise<SaveAnswersResult>;
}

interface AnswerSnapshot {
  answers: AttemptAnswers;
  fingerprint: string;
}

interface FlushWaiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

function createSnapshot(answers: AttemptAnswers): AnswerSnapshot {
  return {
    answers,
    fingerprint: JSON.stringify(answers),
  };
}

export function useAttemptAutosave({
  answers,
  initialAnswers,
  initialLastSavedAt,
  enabled,
  isPayloadValid,
  hasLocalDraft = false,
  saveAnswers,
}: UseAttemptAutosaveOptions) {
  const [initialSnapshot] = useState(() => createSnapshot(initialAnswers));
  const latestSnapshotRef = useRef(initialSnapshot);
  const savedFingerprintRef = useRef(initialSnapshot.fingerprint);
  const pendingSnapshotRef = useRef<AnswerSnapshot | null>(null);
  const saveAnswersRef = useRef(saveAnswers);
  const enabledRef = useRef(enabled);
  const payloadValidRef = useRef(isPayloadValid);
  const isMountedRef = useRef(true);
  const isSavingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushWaitersRef = useRef<FlushWaiter[]>([]);
  const drainRef = useRef<() => void>(() => undefined);
  const [status, setStatus] = useState<AutosaveStatus>(AUTOSAVE_STATUS.SAVED);
  const [lastSavedAt, setLastSavedAt] = useState(initialLastSavedAt);

  const resolveFlushWaiters = useCallback(() => {
    const waiters = flushWaitersRef.current;
    flushWaitersRef.current = [];
    waiters.forEach((waiter) => waiter.resolve());
  }, []);

  const rejectFlushWaiters = useCallback((error: unknown) => {
    const waiters = flushWaitersRef.current;
    flushWaitersRef.current = [];
    waiters.forEach((waiter) => waiter.reject(error));
  }, []);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const drain: () => void = useCallback(() => {
    if (
      !enabledRef.current ||
      !payloadValidRef.current ||
      isSavingRef.current ||
      !pendingSnapshotRef.current
    ) {
      return;
    }

    clearDebounceTimer();
    clearRetryTimer();
    const snapshot = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    isSavingRef.current = true;
    setStatus(AUTOSAVE_STATUS.SAVING);

    void saveAnswersRef
      .current(snapshot.answers)
      .then((result) => {
        if (!isMountedRef.current || !enabledRef.current) {
          return;
        }

        savedFingerprintRef.current = snapshot.fingerprint;
        setLastSavedAt(result.lastSavedAt);

        if (!payloadValidRef.current) {
          setStatus(AUTOSAVE_STATUS.UNSAVED);
        } else if (
          latestSnapshotRef.current.fingerprint !== savedFingerprintRef.current
        ) {
          pendingSnapshotRef.current = latestSnapshotRef.current;
          setStatus(AUTOSAVE_STATUS.UNSAVED);
        } else {
          setStatus(AUTOSAVE_STATUS.SAVED);
        }
      })
      .catch((error: unknown) => {
        if (!isMountedRef.current || !enabledRef.current) {
          return;
        }

        if (!payloadValidRef.current) {
          setStatus(AUTOSAVE_STATUS.UNSAVED);
          return;
        }

        if (
          latestSnapshotRef.current.fingerprint !== savedFingerprintRef.current
        ) {
          pendingSnapshotRef.current = latestSnapshotRef.current;
        }

        setStatus(AUTOSAVE_STATUS.ERROR);
        rejectFlushWaiters(error);
        clearRetryTimer();
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          drainRef.current();
        }, AUTOSAVE_RETRY_MS);
      })
      .finally(() => {
        isSavingRef.current = false;

        if (
          isMountedRef.current &&
          enabledRef.current &&
          pendingSnapshotRef.current &&
          !retryTimerRef.current
        ) {
          drainRef.current();
        } else if (!pendingSnapshotRef.current) {
          resolveFlushWaiters();
        }
      });
  }, [
    clearDebounceTimer,
    clearRetryTimer,
    rejectFlushWaiters,
    resolveFlushWaiters,
  ]);

  useEffect(() => {
    drainRef.current = drain;
  }, [drain]);

  useEffect(() => {
    saveAnswersRef.current = saveAnswers;
  }, [saveAnswers]);

  useEffect(() => {
    enabledRef.current = enabled;

    if (!enabled) {
      clearDebounceTimer();
      clearRetryTimer();
      pendingSnapshotRef.current = null;
      resolveFlushWaiters();
    }
  }, [clearDebounceTimer, clearRetryTimer, enabled, resolveFlushWaiters]);

  useEffect(() => {
    payloadValidRef.current = isPayloadValid;

    if (!isPayloadValid) {
      clearDebounceTimer();
      clearRetryTimer();
      pendingSnapshotRef.current = null;
      resolveFlushWaiters();
    }
  }, [
    clearDebounceTimer,
    clearRetryTimer,
    isPayloadValid,
    resolveFlushWaiters,
  ]);

  useEffect(() => {
    const snapshot = createSnapshot(answers);
    latestSnapshotRef.current = snapshot;

    if (!enabled) {
      return;
    }

    if (!isPayloadValid) {
      return;
    }

    if (snapshot.fingerprint === savedFingerprintRef.current) {
      pendingSnapshotRef.current = null;
      clearDebounceTimer();

      if (!isSavingRef.current) {
        setStatus(AUTOSAVE_STATUS.SAVED);
      }

      return;
    }

    pendingSnapshotRef.current = snapshot;

    if (!isSavingRef.current) {
      clearDebounceTimer();
      clearRetryTimer();
      setStatus(AUTOSAVE_STATUS.UNSAVED);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        drain();
      }, AUTOSAVE_DEBOUNCE_MS);
    }
  }, [
    answers,
    clearDebounceTimer,
    clearRetryTimer,
    drain,
    enabled,
    isPayloadValid,
  ]);

  useEffect(() => {
    if (!enabled || (status === AUTOSAVE_STATUS.SAVED && !hasLocalDraft)) {
      return;
    }

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [enabled, hasLocalDraft, status]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearDebounceTimer();
      clearRetryTimer();
      pendingSnapshotRef.current = null;
      resolveFlushWaiters();
    };
  }, [clearDebounceTimer, clearRetryTimer, resolveFlushWaiters]);

  function flush(): Promise<void> {
    if (!enabledRef.current || !payloadValidRef.current) {
      return Promise.resolve();
    }

    if (latestSnapshotRef.current.fingerprint !== savedFingerprintRef.current) {
      pendingSnapshotRef.current = latestSnapshotRef.current;
    }

    clearDebounceTimer();
    clearRetryTimer();

    if (!pendingSnapshotRef.current && !isSavingRef.current) {
      return Promise.resolve();
    }

    const completion = new Promise<void>((resolve, reject) => {
      flushWaitersRef.current.push({ resolve, reject });
    });
    drain();
    return completion;
  }

  return {
    status:
      enabled && (!isPayloadValid || hasLocalDraft)
        ? AUTOSAVE_STATUS.UNSAVED
        : status,
    lastSavedAt,
    flush,
  };
}
