"use client";

import { useEffect, useEffectEvent, useState } from "react";

interface CountdownTimerProps {
  expiresAt: string;
  serverNow: string;
  onRemainingChange?: (remainingMilliseconds: number) => void;
  onExpired?: () => void;
}

export function getServerSynchronizedRemainingMilliseconds(
  expiresAt: string,
  serverNow: string,
  elapsedMilliseconds: number,
): number {
  return Math.max(
    0,
    new Date(expiresAt).getTime() -
      new Date(serverNow).getTime() -
      elapsedMilliseconds,
  );
}

export function formatCountdown(remainingMilliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMilliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

export function CountdownTimer({
  expiresAt,
  serverNow,
  onRemainingChange,
  onExpired,
}: CountdownTimerProps) {
  const [remainingMilliseconds, setRemainingMilliseconds] = useState(() =>
    getServerSynchronizedRemainingMilliseconds(expiresAt, serverNow, 0),
  );
  const emitRemainingChange = useEffectEvent((remaining: number) =>
    onRemainingChange?.(remaining),
  );
  const emitExpired = useEffectEvent(() => onExpired?.());

  useEffect(() => {
    const startedAt = performance.now();
    let hasEmittedExpiration = false;

    function updateRemainingTime() {
      const remaining = getServerSynchronizedRemainingMilliseconds(
        expiresAt,
        serverNow,
        performance.now() - startedAt,
      );
      setRemainingMilliseconds(remaining);
      emitRemainingChange(remaining);

      if (remaining === 0 && !hasEmittedExpiration) {
        hasEmittedExpiration = true;
        emitExpired();
      }
    }

    updateRemainingTime();
    const intervalId = window.setInterval(updateRemainingTime, 1000);

    return () => window.clearInterval(intervalId);
  }, [expiresAt, serverNow]);

  const displayTime = formatCountdown(remainingMilliseconds);

  return (
    <time
      role="timer"
      dateTime={expiresAt}
      aria-label={`Thời gian còn lại ${displayTime}`}
      className="font-mono text-xl font-bold tracking-tight tabular-nums"
    >
      {displayTime}
    </time>
  );
}
