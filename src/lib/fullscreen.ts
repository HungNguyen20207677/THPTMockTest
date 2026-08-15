export function isFullscreenSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    document.fullscreenEnabled &&
    typeof document.documentElement.requestFullscreen === "function"
  );
}

export async function requestDocumentFullscreen(): Promise<boolean> {
  if (typeof document === "undefined") {
    return false;
  }

  if (document.fullscreenElement) {
    return true;
  }

  if (!isFullscreenSupported()) {
    return false;
  }

  try {
    await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function exitDocumentFullscreen(): Promise<boolean> {
  if (typeof document === "undefined" || !document.fullscreenElement) {
    return true;
  }

  try {
    await document.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}
