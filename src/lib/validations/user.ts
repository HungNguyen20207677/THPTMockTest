import { z } from "zod";

import {
  BCRYPT_MAX_PASSWORD_BYTES,
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  PASSWORD_MAX_CHARACTERS,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from "@/lib/constants/user";
import { normalizeUsername } from "@/lib/utils/username";

function createPasswordSchema(minLength: number, minLengthMessage: string) {
  return z
    .string()
    .min(minLength, minLengthMessage)
    .max(PASSWORD_MAX_CHARACTERS, "Mật khẩu quá dài.")
    .refine(
      (password) =>
        new TextEncoder().encode(password).length <= BCRYPT_MAX_PASSWORD_BYTES,
      "Mật khẩu vượt quá giới hạn 72 byte.",
    );
}

export const usernameSchema = z
  .string()
  .trim()
  .min(
    USERNAME_MIN_LENGTH,
    `Tên đăng nhập phải có ít nhất ${USERNAME_MIN_LENGTH} ký tự.`,
  )
  .max(
    USERNAME_MAX_LENGTH,
    `Tên đăng nhập không được vượt quá ${USERNAME_MAX_LENGTH} ký tự.`,
  )
  .regex(
    USERNAME_PATTERN,
    "Tên đăng nhập chỉ được chứa chữ cái, số, dấu chấm, gạch dưới hoặc gạch ngang.",
  )
  .transform(normalizeUsername);

export const fullNameSchema = z
  .string()
  .trim()
  .min(
    FULL_NAME_MIN_LENGTH,
    `Họ và tên phải có ít nhất ${FULL_NAME_MIN_LENGTH} ký tự.`,
  )
  .max(
    FULL_NAME_MAX_LENGTH,
    `Họ và tên không được vượt quá ${FULL_NAME_MAX_LENGTH} ký tự.`,
  );

export const loginPasswordSchema = createPasswordSchema(
  1,
  "Vui lòng nhập mật khẩu.",
);

export const accountPasswordSchema = createPasswordSchema(
  PASSWORD_MIN_LENGTH,
  `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`,
);

export const createStudentSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  password: accountPasswordSchema,
});

export const updateStudentSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
});

export const resetStudentPasswordSchema = z
  .object({
    password: accountPasswordSchema,
    confirmPassword: accountPasswordSchema,
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp.",
    path: ["confirmPassword"],
  });

export const updateStudentStatusSchema = z.object({
  isActive: z.boolean(),
});

export const studentIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã học sinh không hợp lệ.")
  .transform((studentId) => studentId.toLowerCase());

export const createInitialAdminSchema = createStudentSchema;

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ResetStudentPasswordInput = z.infer<
  typeof resetStudentPasswordSchema
>;
export type UpdateStudentStatusInput = z.infer<
  typeof updateStudentStatusSchema
>;
export type CreateInitialAdminInput = z.infer<typeof createInitialAdminSchema>;
