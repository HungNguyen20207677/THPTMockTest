import { z } from "zod";

import {
  ESSAY_IMAGE_ALLOWED_MIME_TYPES,
  ESSAY_IMAGE_MAX_BYTES,
} from "@/lib/constants/exam-attempt";
import { EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH } from "@/lib/constants/exam-structure-template";

export interface EssayImageFileMetadata {
  name: string;
  type: string;
  size: number;
}

const MIME_TYPE_EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export function getEssayImageValidationError(
  file: EssayImageFileMetadata,
): string | null {
  if (file.name.length > 255) {
    return "Tên tệp ảnh không được vượt quá 255 ký tự.";
  }

  if (/[\u0000-\u001f\u007f/\\]/.test(file.name)) {
    return "Tên tệp ảnh chứa ký tự không hợp lệ.";
  }

  if (!ESSAY_IMAGE_ALLOWED_MIME_TYPES.some((type) => type === file.type)) {
    return "Ảnh phải có định dạng JPEG, PNG hoặc WebP.";
  }

  const extensions = MIME_TYPE_EXTENSIONS[file.type];
  const lowerName = file.name.toLowerCase();

  if (!extensions?.some((extension) => lowerName.endsWith(extension))) {
    return "Phần mở rộng tệp ảnh không khớp với định dạng ảnh.";
  }

  if (file.size <= 0) {
    return "Tệp ảnh không được để trống.";
  }

  if (file.size > ESSAY_IMAGE_MAX_BYTES) {
    return "Mỗi ảnh không được vượt quá 10 MB.";
  }

  return null;
}

export const essayImageUploadIntentSchema = z.strictObject({
  name: z.string().trim().min(1).max(255),
  type: z.enum(ESSAY_IMAGE_ALLOWED_MIME_TYPES),
  size: z.number().int().positive().max(ESSAY_IMAGE_MAX_BYTES),
});

export const essayImageUploadReferenceSchema = z.strictObject({
  publicId: z.string().trim().min(1).max(255),
  originalFilename: z.string().trim().min(1).max(255),
  timestamp: z.number().int().positive(),
  signature: z.string().regex(/^[a-f\d]{40,64}$/i),
});

export const attachEssayImageRequestSchema = z.strictObject({
  upload: essayImageUploadReferenceSchema,
});

export const removeEssayImageRequestSchema = z.strictObject({
  publicId: z.string().trim().min(1).max(255),
});

export const essayImageQuestionIdSchema = z
  .string()
  .trim()
  .min(1, "Mã câu hỏi không hợp lệ.")
  .max(EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH, "Mã câu hỏi không hợp lệ.");

export type EssayImageUploadIntent = z.infer<
  typeof essayImageUploadIntentSchema
>;
