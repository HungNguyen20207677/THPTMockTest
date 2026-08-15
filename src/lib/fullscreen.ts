export function isFullscreenSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    document.fullscreenEnabled &&
    typeof document.documentElement.requestFullscreen === "function"
  );
}

export function isDocumentElementFullscreen(): boolean {
  return (
    typeof document !== "undefined" &&
    document.fullscreenElement === document.documentElement
  );
}

export async function requestDocumentFullscreen(): Promise<boolean> {
  if (typeof document === "undefined") {
    return false;
  }

  if (isDocumentElementFullscreen()) {
    return true;
  }

  if (document.fullscreenElement) {
    return false;
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

  if (!isDocumentElementFullscreen()) {
    return false;
  }

  try {
    await document.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}
