import "server-only";

import { deleteEssayImage } from "@/lib/cloudinary/essay-image";
import { deleteExamPdf } from "@/lib/cloudinary/exam-pdf";
import type { HardDeleteResult } from "@/types/deletion";

const CLEANUP_RETRY_DELAYS_MS = [0, 100, 500] as const;
const ESSAY_IMAGE_CLEANUP_CONCURRENCY = 4;

export const HARD_DELETE_CLEANUP_WARNING =
  "Dữ liệu đã được xóa khỏi hệ thống nhưng một số tệp trên Cloudinary chưa thể xóa. Vui lòng kiểm tra log hoặc thử dọn dẹp lại.";

type CloudinaryResourceType = "essay-image" | "exam-pdf";

interface CleanupFailure {
  resourceType: CloudinaryResourceType;
  publicId: string;
  errorName: string;
}

function sanitizePublicIdForLog(publicId: string): string {
  return publicId.replace(/[^a-zA-Z0-9_./-]/g, "?").slice(0, 255);
}

function isAlreadyMissingError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as { http_code?: unknown; statusCode?: unknown };
  return candidate.http_code === 404 || candidate.statusCode === 404;
}

async function deleteWithRetry(
  resourceType: CloudinaryResourceType,
  publicId: string,
  operation: () => Promise<void>,
): Promise<CleanupFailure | null> {
  let lastError: unknown;

  for (const delayMs of CLEANUP_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      await operation();
      return null;
    } catch (error) {
      if (isAlreadyMissingError(error)) return null;
      lastError = error;
    }
  }

  return {
    resourceType,
    publicId,
    errorName: lastError instanceof Error ? lastError.name : "UnknownError",
  };
}

export async function cleanupCloudinaryAfterHardDelete(input: {
  essayImagePublicIds: string[];
  examPdfPublicId?: string;
}): Promise<HardDeleteResult> {
  const essayImagePublicIds = [...new Set(input.essayImagePublicIds)];
  const failures: CleanupFailure[] = [];
  let nextImageIndex = 0;

  async function deleteNextEssayImages() {
    while (nextImageIndex < essayImagePublicIds.length) {
      const publicId = essayImagePublicIds[nextImageIndex];
      nextImageIndex += 1;

      if (!publicId) continue;

      const failure = await deleteWithRetry("essay-image", publicId, () =>
        deleteEssayImage(publicId),
      );
      if (failure) failures.push(failure);
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          ESSAY_IMAGE_CLEANUP_CONCURRENCY,
          essayImagePublicIds.length,
        ),
      },
      () => deleteNextEssayImages(),
    ),
  );

  if (input.examPdfPublicId) {
    const pdfPublicId = input.examPdfPublicId;
    const failure = await deleteWithRetry("exam-pdf", pdfPublicId, () =>
      deleteExamPdf(pdfPublicId),
    );
    if (failure) failures.push(failure);
  }

  for (const failure of failures) {
    console.error("Cloudinary hard-delete cleanup failed.", {
      resourceType: failure.resourceType,
      publicId: sanitizePublicIdForLog(failure.publicId),
      errorName: failure.errorName,
      attempts: CLEANUP_RETRY_DELAYS_MS.length,
    });
  }

  return {
    cleanupWarning: failures.length > 0 ? HARD_DELETE_CLEANUP_WARNING : null,
  };
}
