import { afterEach, describe, expect, it, vi } from "vitest";

import {
  exitDocumentFullscreen,
  isFullscreenSupported,
  requestDocumentFullscreen,
} from "@/lib/fullscreen";

function stubDocument({
  fullscreenEnabled = true,
  fullscreenElement = null,
  requestFullscreen = vi.fn().mockResolvedValue(undefined),
  exitFullscreen = vi.fn().mockResolvedValue(undefined),
}: {
  fullscreenEnabled?: boolean;
  fullscreenElement?: object | null;
  requestFullscreen?: ReturnType<typeof vi.fn>;
  exitFullscreen?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.stubGlobal("document", {
    fullscreenEnabled,
    fullscreenElement,
    documentElement: { requestFullscreen },
    exitFullscreen,
  });

  return { requestFullscreen, exitFullscreen };
}

describe("fullscreen browser helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports unavailable fullscreen without a browser document", () => {
    expect(isFullscreenSupported()).toBe(false);
  });

  it("requests fullscreen from the document element", async () => {
    const { requestFullscreen } = stubDocument();

    await expect(requestDocumentFullscreen()).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it("does not fail the caller when fullscreen is denied", async () => {
    const requestFullscreen = vi
      .fn()
      .mockRejectedValue(new Error("Permission denied"));
    stubDocument({ requestFullscreen });

    await expect(requestDocumentFullscreen()).resolves.toBe(false);
  });

  it("exits an active fullscreen document", async () => {
    const { exitFullscreen } = stubDocument({ fullscreenElement: {} });

    await expect(exitDocumentFullscreen()).resolves.toBe(true);
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });
});
