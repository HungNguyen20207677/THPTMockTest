import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { getCloudinaryClient } from "@/lib/cloudinary/client";
import {
  ESSAY_IMAGE_ALLOWED_FORMATS,
  ESSAY_IMAGE_CLOUDINARY_FOLDER,
  ESSAY_IMAGE_MAX_BYTES,
  ESSAY_IMAGE_UPLOAD_SIGNATURE_MAX_AGE_SECONDS,
} from "@/lib/constants/exam-attempt";
import { getCloudinaryEnvironment } from "@/lib/env/server";
import {
  EssayImageTooLargeError,
  EssayImageUploadError,
  EssayImageValidationError,
} from "@/lib/errors/app-error";
import {
  getEssayImageValidationError,
  type EssayImageUploadIntent,
} from "@/lib/validations/essay-image";
import type {
  EssayImage,
  EssayImageSignedUploadFields,
  EssayImageUploadReference,
  EssayImageUploadTicket,
} from "@/types/exam-attempt";

const CLOUDINARY_REQUEST_TIMEOUT_MS = 60_000;
const UUID_PATTERN =
  /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

const cloudinaryEssayImageSchema = z.object({
  public_id: z.string(),
  resource_type: z.literal("image"),
  type: z.literal("upload"),
  bytes: z.number().int().positive(),
  secure_url: z.url().refine((url) => url.startsWith("https://")),
  format: z.enum(ESSAY_IMAGE_ALLOWED_FORMATS),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  placeholder: z.boolean().optional(),
});

export interface EssayImageUploadScope {
  studentId: string;
  attemptId: string;
  questionId: string;
}

function getScopeFolder(scope: EssayImageUploadScope): string {
  const scopeHash = createHash("sha256")
    .update(scope.studentId)
    .update("\0")
    .update(scope.attemptId)
    .update("\0")
    .update(scope.questionId)
    .digest("hex");
  return `${ESSAY_IMAGE_CLOUDINARY_FOLDER}/${scopeHash}`;
}

function createSignedFields(
  publicId: string,
  originalFilename: string,
  timestamp: number,
): EssayImageSignedUploadFields {
  return {
    timestamp: String(timestamp),
    public_id: publicId,
    overwrite: "0",
    allowed_formats: "jpg,jpeg,png,webp",
    filename_override: originalFilename,
    type: "upload",
  };
}

function isExpectedPublicId(
  publicId: string,
  scope: EssayImageUploadScope,
): boolean {
  const prefix = `${getScopeFolder(scope)}/`;
  return (
    publicId.startsWith(prefix) &&
    UUID_PATTERN.test(publicId.slice(prefix.length))
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

function assertValidUploadReference(
  reference: EssayImageUploadReference,
  scope: EssayImageUploadScope,
): void {
  if (!isExpectedPublicId(reference.publicId, scope)) {
    throw new EssayImageValidationError();
  }

  const filenameError = getEssayImageValidationError({
    name: reference.originalFilename,
    type: getMimeTypeFromFilename(reference.originalFilename),
    size: 1,
  });

  if (filenameError) {
    throw new EssayImageValidationError(filenameError);
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
    throw new EssayImageValidationError("Chữ ký tải ảnh không hợp lệ.");
  }

  const age = Math.floor(Date.now() / 1000) - reference.timestamp;

  if (age < -60 || age > ESSAY_IMAGE_UPLOAD_SIGNATURE_MAX_AGE_SECONDS) {
    throw new EssayImageValidationError(
      "Thông tin tải ảnh không hợp lệ hoặc đã hết hạn.",
    );
  }
}

function getMimeTypeFromFilename(filename: string): string {
  const lowerFilename = filename.toLowerCase();

  if (lowerFilename.endsWith(".jpg") || lowerFilename.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerFilename.endsWith(".png")) {
    return "image/png";
  }
  if (lowerFilename.endsWith(".webp")) {
    return "image/webp";
  }
  return "";
}

function isExpectedSecureUrl(
  secureUrl: string,
  cloudName: string,
  publicId: string,
  format: string,
): boolean {
  try {
    const url = new URL(secureUrl);
    const uploadPrefix = `/${encodeURIComponent(cloudName)}/image/upload/`;
    const assetSuffix = `/${publicId}.${format}`;
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

export function createEssayImageUploadTicket(
  scope: EssayImageUploadScope,
  intent: EssayImageUploadIntent,
): EssayImageUploadTicket {
  const normalizedIntent = { ...intent, name: intent.name.trim() };

  if (normalizedIntent.size > ESSAY_IMAGE_MAX_BYTES) {
    throw new EssayImageTooLargeError();
  }

  const metadataError = getEssayImageValidationError(normalizedIntent);

  if (metadataError) {
    throw new EssayImageValidationError(metadataError);
  }

  const environment = getCloudinaryEnvironment();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${getScopeFolder(scope)}/${randomUUID()}`;
  const fields = createSignedFields(publicId, normalizedIntent.name, timestamp);
  const signature = getCloudinaryClient().utils.api_sign_request(
    fields,
    environment.apiSecret,
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(environment.cloudName)}/image/upload`,
    apiKey: environment.apiKey,
    signature,
    fields,
  };
}

export async function verifyEssayImageAsset(
  reference: EssayImageUploadReference,
  scope: EssayImageUploadScope,
): Promise<EssayImage> {
  assertValidUploadReference(reference, scope);

  let resource: unknown;

  try {
    resource = await getCloudinaryClient().api.resource(reference.publicId, {
      resource_type: "image",
      type: "upload",
      timeout: CLOUDINARY_REQUEST_TIMEOUT_MS,
    });
  } catch {
    throw new EssayImageUploadError();
  }

  const parsedResource = cloudinaryEssayImageSchema.safeParse(resource);

  if (!parsedResource.success) {
    throw new EssayImageValidationError();
  }

  const asset = parsedResource.data;

  if (asset.bytes > ESSAY_IMAGE_MAX_BYTES) {
    throw new EssayImageTooLargeError();
  }

  if (
    asset.public_id !== reference.publicId ||
    !isExpectedPublicId(asset.public_id, scope) ||
    asset.placeholder === true ||
    !isExpectedSecureUrl(
      asset.secure_url,
      getCloudinaryEnvironment().cloudName,
      asset.public_id,
      asset.format,
    )
  ) {
    throw new EssayImageValidationError();
  }

  return {
    publicId: asset.public_id,
    secureUrl: asset.secure_url,
    originalFilename: reference.originalFilename,
    bytes: asset.bytes,
    format: asset.format,
    width: asset.width,
    height: asset.height,
  };
}

export async function deleteEssayImage(publicId: string): Promise<void> {
  const result: unknown = await getCloudinaryClient().uploader.destroy(
    publicId,
    {
      resource_type: "image",
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
}
