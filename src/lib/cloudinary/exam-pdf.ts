import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { getCloudinaryClient } from "@/lib/cloudinary/client";
import {
  EXAM_PDF_CLOUDINARY_FOLDER,
  EXAM_PDF_MAX_BYTES,
  EXAM_PDF_MIME_TYPE,
  EXAM_PDF_UPLOAD_SIGNATURE_MAX_AGE_SECONDS,
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
  ExamPdfSignedUploadFields,
  ExamPdfUploadReference,
  ExamPdfUploadTicket,
} from "@/types/exam";

const PDF_SIGNATURE = "%PDF-";
const CLOUDINARY_REQUEST_TIMEOUT_MS = 60_000;
const DISCARD_RETRY_DELAYS_MS = [0, 500, 1_500] as const;
const UUID_PDF_PATTERN =
  /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.pdf$/i;

const cloudinaryRawPdfSchema = z.object({
  public_id: z.string(),
  resource_type: z.literal("raw"),
  type: z.literal("upload"),
  bytes: z.number().int().positive(),
  secure_url: z.url().refine((url) => url.startsWith("https://")),
  placeholder: z.boolean().optional(),
});

function createSignedFields(
  publicId: string,
  originalFilename: string,
  timestamp: number,
): ExamPdfSignedUploadFields {
  return {
    timestamp: String(timestamp),
    public_id: publicId,
    overwrite: "0",
    allowed_formats: "pdf",
    filename_override: originalFilename,
    type: "upload",
  };
}

function isExpectedExamPdfPublicId(publicId: string): boolean {
  const prefix = `${EXAM_PDF_CLOUDINARY_FOLDER}/`;

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

export function assertAuthenticExamPdfUploadReference(
  reference: ExamPdfUploadReference,
): void {
  if (!isExpectedExamPdfPublicId(reference.publicId)) {
    throw new ExamPdfValidationError("Thông tin tải PDF không hợp lệ.");
  }

  const filenameError = getExamPdfValidationError({
    name: reference.originalFilename,
    type: EXAM_PDF_MIME_TYPE,
    size: 1,
  });

  if (filenameError) {
    throw new ExamPdfValidationError(filenameError);
  }

  const fields = createSignedFields(
    reference.publicId,
    reference.originalFilename,
    reference.timestamp,
  );
  const environment = getCloudinaryEnvironment();
  const expectedSignature = getCloudinaryClient().utils.api_sign_request(
    fields,
    environment.apiSecret,
  );

  if (!signaturesMatch(reference.signature, expectedSignature)) {
    throw new ExamPdfValidationError("Chữ ký tải PDF không hợp lệ.");
  }
}

function assertFreshUploadReference(reference: ExamPdfUploadReference): void {
  const age = Math.floor(Date.now() / 1000) - reference.timestamp;

  if (age < -60 || age > EXAM_PDF_UPLOAD_SIGNATURE_MAX_AGE_SECONDS) {
    throw new ExamPdfValidationError(
      "Thông tin tải PDF không hợp lệ hoặc đã hết hạn.",
    );
  }
}

export function assertValidExamPdfUploadReference(
  reference: ExamPdfUploadReference,
): void {
  assertAuthenticExamPdfUploadReference(reference);
  assertFreshUploadReference(reference);
}

function isExpectedCloudinarySecureUrl(
  secureUrl: string,
  cloudName: string,
  publicId: string,
): boolean {
  try {
    const url = new URL(secureUrl);
    const uploadPrefix = `/${encodeURIComponent(cloudName)}/raw/upload/`;
    const assetSuffix = `/${publicId}`;
    const version = url.pathname.slice(
      uploadPrefix.length,
      -assetSuffix.length,
    );

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      url.pathname.startsWith(uploadPrefix) &&
      url.pathname.endsWith(assetSuffix) &&
      /^v\d+$/.test(version)
    );
  } catch {
    return false;
  }
}

async function hasPdfSignature(secureUrl: string): Promise<boolean> {
  try {
    const response = await fetch(secureUrl, {
      headers: { Range: `bytes=0-${PDF_SIGNATURE.length - 1}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(CLOUDINARY_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok || !response.body) {
      return false;
    }

    const reader = response.body.getReader();
    const signatureBytes: number[] = [];

    try {
      while (signatureBytes.length < PDF_SIGNATURE.length) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        for (const byte of value) {
          signatureBytes.push(byte);

          if (signatureBytes.length === PDF_SIGNATURE.length) {
            break;
          }
        }
      }
    } finally {
      await reader.cancel();
    }

    return Buffer.from(signatureBytes).toString("ascii") === PDF_SIGNATURE;
  } catch {
    return false;
  }
}

export function createExamPdfUploadTicket(
  intent: ExamPdfUploadIntent,
): ExamPdfUploadTicket {
  const normalizedIntent = { ...intent, name: intent.name.trim() };

  if (normalizedIntent.size > EXAM_PDF_MAX_BYTES) {
    throw new ExamPdfTooLargeError();
  }

  const metadataError = getExamPdfValidationError(normalizedIntent);

  if (metadataError) {
    throw new ExamPdfValidationError(metadataError);
  }

  const environment = getCloudinaryEnvironment();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${EXAM_PDF_CLOUDINARY_FOLDER}/${randomUUID()}.pdf`;
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

export async function verifyExamPdfAsset(
  reference: ExamPdfUploadReference,
): Promise<ExamPdf> {
  assertValidExamPdfUploadReference(reference);

  let resource: unknown;

  try {
    resource = await getCloudinaryClient().api.resource(reference.publicId, {
      resource_type: "raw",
      type: "upload",
      timeout: CLOUDINARY_REQUEST_TIMEOUT_MS,
    });
  } catch {
    throw new ExamPdfUploadError();
  }

  const parsedResource = cloudinaryRawPdfSchema.safeParse(resource);

  if (!parsedResource.success) {
    throw new ExamPdfValidationError(
      "Tài nguyên Cloudinary không phải PDF hợp lệ.",
    );
  }

  const asset = parsedResource.data;

  if (asset.bytes > EXAM_PDF_MAX_BYTES) {
    throw new ExamPdfTooLargeError();
  }

  if (
    asset.public_id !== reference.publicId ||
    !isExpectedExamPdfPublicId(asset.public_id) ||
    asset.placeholder === true ||
    !isExpectedCloudinarySecureUrl(
      asset.secure_url,
      getCloudinaryEnvironment().cloudName,
      reference.publicId,
    ) ||
    !(await hasPdfSignature(asset.secure_url))
  ) {
    throw new ExamPdfValidationError(
      "Tài nguyên Cloudinary không phải PDF hợp lệ.",
    );
  }

  return {
    publicId: asset.public_id,
    secureUrl: asset.secure_url,
    originalFilename: reference.originalFilename,
  };
}

export async function discardExamPdfUpload(
  reference: ExamPdfUploadReference,
): Promise<void> {
  assertAuthenticExamPdfUploadReference(reference);

  let lastError: unknown;

  for (const delayMs of DISCARD_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      if (await destroyExamPdf(reference.publicId)) {
        return;
      }

      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
}

async function destroyExamPdf(publicId: string): Promise<boolean> {
  const result: unknown = await getCloudinaryClient().uploader.destroy(
    publicId,
    {
      resource_type: "raw",
      type: "upload",
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

export async function deleteExamPdf(publicId: string): Promise<void> {
  await destroyExamPdf(publicId);
}
