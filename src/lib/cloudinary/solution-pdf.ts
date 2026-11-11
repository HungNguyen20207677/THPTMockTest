import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { getCloudinaryClient } from "@/lib/cloudinary/client";
import {
  EXAM_PDF_MAX_BYTES,
  EXAM_PDF_MIME_TYPE,
  EXAM_PDF_UPLOAD_SIGNATURE_MAX_AGE_SECONDS,
  SOLUTION_PDF_CLOUDINARY_FOLDER,
} from "@/lib/constants/exam";
import { getCloudinaryEnvironment } from "@/lib/env/server";
import {
  ExamPdfTooLargeError,
  ExamPdfUploadError,
  ExamPdfValidationError,
} from "@/lib/errors/app-error";
import {
  getExamPdfValidationError,
  type ExamPdfUploadIntent,
} from "@/lib/validations/exam-pdf";
import type {
  ExamPdf,
  ExamPdfUploadReference,
  SolutionPdfSignedUploadFields,
  SolutionPdfUploadTicket,
} from "@/types/exam";

const PDF_SIGNATURE = "%PDF-";
const CLOUDINARY_REQUEST_TIMEOUT_MS = 60_000;
const DISCARD_RETRY_DELAYS_MS = [0, 500, 1_500] as const;
const UUID_PDF_PATTERN =
  /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.pdf$/i;

const cloudinarySolutionPdfSchema = z.object({
  public_id: z.string(),
  resource_type: z.literal("raw"),
  type: z.literal("authenticated"),
  bytes: z.number().int().positive(),
  secure_url: z.url().refine((url) => url.startsWith("https://")),
  placeholder: z.boolean().optional(),
});

function createSignedFields(
  publicId: string,
  originalFilename: string,
  timestamp: number,
): SolutionPdfSignedUploadFields {
  return {
    timestamp: String(timestamp),
    public_id: publicId,
    overwrite: "0",
    allowed_formats: "pdf",
    filename_override: originalFilename,
    type: "authenticated",
  };
}

function isExpectedPublicId(publicId: string): boolean {
  const prefix = `${SOLUTION_PDF_CLOUDINARY_FOLDER}/`;
  return (
    publicId.startsWith(prefix) &&
    UUID_PDF_PATTERN.test(publicId.slice(prefix.length))
  );
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function assertAuthenticSolutionPdfUploadReference(
  reference: ExamPdfUploadReference,
): void {
  if (!isExpectedPublicId(reference.publicId)) {
    throw new ExamPdfValidationError("Thông tin tải PDF lời giải không hợp lệ.");
  }

  const filenameError = getExamPdfValidationError({
    name: reference.originalFilename,
    type: EXAM_PDF_MIME_TYPE,
    size: 1,
  });
  if (filenameError) throw new ExamPdfValidationError(filenameError);

  const fields = createSignedFields(
    reference.publicId,
    reference.originalFilename,
    reference.timestamp,
  );
  const expectedSignature = getCloudinaryClient().utils.api_sign_request(
    fields,
    getCloudinaryEnvironment().apiSecret,
  );
  if (!signaturesMatch(reference.signature, expectedSignature)) {
    throw new ExamPdfValidationError("Chữ ký tải PDF lời giải không hợp lệ.");
  }
}

export function assertValidSolutionPdfUploadReference(
  reference: ExamPdfUploadReference,
): void {
  assertAuthenticSolutionPdfUploadReference(reference);
  const age = Math.floor(Date.now() / 1000) - reference.timestamp;
  if (age < -60 || age > EXAM_PDF_UPLOAD_SIGNATURE_MAX_AGE_SECONDS) {
    throw new ExamPdfValidationError(
      "Thông tin tải PDF lời giải không hợp lệ hoặc đã hết hạn.",
    );
  }
}

function getSignedDeliveryUrl(publicId: string): string {
  return getCloudinaryClient().url(publicId, {
    resource_type: "raw",
    type: "authenticated",
    secure: true,
    sign_url: true,
  });
}

async function hasPdfSignature(publicId: string): Promise<boolean> {
  try {
    const response = await fetch(getSignedDeliveryUrl(publicId), {
      headers: { Range: `bytes=0-${PDF_SIGNATURE.length - 1}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(CLOUDINARY_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok || !response.body) return false;

    const reader = response.body.getReader();
    const bytes: number[] = [];
    try {
      while (bytes.length < PDF_SIGNATURE.length) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const byte of value) {
          bytes.push(byte);
          if (bytes.length === PDF_SIGNATURE.length) break;
        }
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.from(bytes).toString("ascii") === PDF_SIGNATURE;
  } catch {
    return false;
  }
}

export function createSolutionPdfUploadTicket(
  intent: ExamPdfUploadIntent,
): SolutionPdfUploadTicket {
  const normalizedIntent = { ...intent, name: intent.name.trim() };
  if (normalizedIntent.size > EXAM_PDF_MAX_BYTES) {
    throw new ExamPdfTooLargeError();
  }
  const metadataError = getExamPdfValidationError(normalizedIntent);
  if (metadataError) throw new ExamPdfValidationError(metadataError);

  const environment = getCloudinaryEnvironment();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${SOLUTION_PDF_CLOUDINARY_FOLDER}/${randomUUID()}.pdf`;
  const fields = createSignedFields(publicId, normalizedIntent.name, timestamp);
  const signature = getCloudinaryClient().utils.api_sign_request(
    fields,
    environment.apiSecret,
  );
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(environment.cloudName)}/raw/upload`,
    apiKey: environment.apiKey,
    signature,
    fields,
  };
}

export async function verifySolutionPdfAsset(
  reference: ExamPdfUploadReference,
): Promise<ExamPdf> {
  assertValidSolutionPdfUploadReference(reference);

  let resource: unknown;
  try {
    resource = await getCloudinaryClient().api.resource(reference.publicId, {
      resource_type: "raw",
      type: "authenticated",
      timeout: CLOUDINARY_REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    console.error("Could not verify a Cloudinary solution PDF asset.", {
      publicId: reference.publicId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw new ExamPdfUploadError();
  }

  const parsed = cloudinarySolutionPdfSchema.safeParse(resource);
  if (!parsed.success) {
    throw new ExamPdfValidationError(
      "Tài nguyên Cloudinary không phải PDF lời giải hợp lệ.",
    );
  }
  const asset = parsed.data;
  if (asset.bytes > EXAM_PDF_MAX_BYTES) throw new ExamPdfTooLargeError();
  if (
    asset.public_id !== reference.publicId ||
    !isExpectedPublicId(asset.public_id) ||
    asset.placeholder === true ||
    !(await hasPdfSignature(asset.public_id))
  ) {
    throw new ExamPdfValidationError(
      "Tài nguyên Cloudinary không phải PDF lời giải hợp lệ.",
    );
  }

  return {
    publicId: asset.public_id,
    secureUrl: asset.secure_url,
    originalFilename: reference.originalFilename,
  };
}

async function destroySolutionPdf(publicId: string): Promise<boolean> {
  const result: unknown = await getCloudinaryClient().uploader.destroy(
    publicId,
    {
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    },
  );
  if (
    typeof result !== "object" ||
    result === null ||
    !("result" in result) ||
    (result.result !== "ok" && result.result !== "not found")
  ) {
    throw new Error("Cloudinary returned an unexpected deletion result.");
  }
  return result.result === "ok";
}

export async function discardSolutionPdfUpload(
  reference: ExamPdfUploadReference,
): Promise<void> {
  assertAuthenticSolutionPdfUploadReference(reference);
  let lastError: unknown;
  for (const delayMs of DISCARD_RETRY_DELAYS_MS) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      if (await destroySolutionPdf(reference.publicId)) return;
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
}

export async function deleteSolutionPdf(publicId: string): Promise<void> {
  await destroySolutionPdf(publicId);
}

export async function createSolutionPdfResponse(asset: ExamPdf): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(getSignedDeliveryUrl(asset.publicId), {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(CLOUDINARY_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ExamPdfUploadError();
  }
  if (!upstream.ok || !upstream.body) throw new ExamPdfUploadError();

  const encodedFilename = encodeURIComponent(asset.originalFilename);
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": EXAM_PDF_MIME_TYPE,
      "Content-Disposition": `inline; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
