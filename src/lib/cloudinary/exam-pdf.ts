import "server-only";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import type { UploadApiErrorResponse, UploadApiResponse } from "cloudinary";

import { getCloudinaryClient } from "@/lib/cloudinary/client";
import {
  EXAM_PDF_CLOUDINARY_FOLDER,
  EXAM_PDF_MAX_BYTES,
} from "@/lib/constants/exam";
import {
  ExamPdfTooLargeError,
  ExamPdfUploadError,
  ExamPdfValidationError,
} from "@/lib/errors/app-error";
import { getExamPdfValidationError } from "@/lib/validations/exam-pdf";
import type { ExamPdf } from "@/types/exam";

const PDF_SIGNATURE = "%PDF-";

export async function validateExamPdf(file: File): Promise<void> {
  if (file.size > EXAM_PDF_MAX_BYTES) {
    throw new ExamPdfTooLargeError();
  }

  const metadataError = getExamPdfValidationError(file);

  if (metadataError) {
    throw new ExamPdfValidationError(metadataError);
  }

  const signature = Buffer.from(
    await file.slice(0, PDF_SIGNATURE.length).arrayBuffer(),
  ).toString("ascii");

  if (signature !== PDF_SIGNATURE) {
    throw new ExamPdfValidationError("Nội dung tệp không phải là PDF hợp lệ.");
  }
}

export async function uploadExamPdf(file: File): Promise<ExamPdf> {
  await validateExamPdf(file);

  const publicId = `${EXAM_PDF_CLOUDINARY_FOLDER}/${randomUUID()}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = getCloudinaryClient().uploader.upload_stream(
        {
          resource_type: "raw",
          public_id: publicId,
          type: "upload",
          overwrite: false,
          allowed_formats: ["pdf"],
        },
        (error?: UploadApiErrorResponse, uploadResult?: UploadApiResponse) => {
          if (error) {
            reject(error);
            return;
          }

          if (!uploadResult) {
            reject(new Error("Cloudinary returned no upload result."));
            return;
          }

          resolve(uploadResult);
        },
      );

      stream.once("error", reject);
      stream.end(buffer);
    });

    if (
      result.resource_type !== "raw" ||
      result.public_id !== publicId ||
      typeof result.secure_url !== "string" ||
      !result.secure_url.startsWith("https://")
    ) {
      throw new Error("Cloudinary returned unexpected PDF metadata.");
    }

    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      originalFilename: file.name,
    };
  } catch {
    try {
      await deleteExamPdf(publicId);
    } catch {
      // Upload cleanup is best-effort; the original safe error is returned.
    }

    throw new ExamPdfUploadError();
  }
}

export async function deleteExamPdf(publicId: string): Promise<void> {
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
}
