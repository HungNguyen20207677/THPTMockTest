"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api/client";
import {
  createStudentAccount,
  resetStudentAccountPassword,
  updateStudentAccount,
} from "@/lib/api/students";
import {
  createStudentSchema,
  resetStudentPasswordSchema,
  updateStudentSchema,
  type CreateStudentInput,
  type ResetStudentPasswordInput,
  type UpdateStudentInput,
} from "@/lib/validations/user";
import type { StudentAccount } from "@/types/user";

interface FormActionsProps {
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  onCancel: () => void;
}

function FormActions({
  isSubmitting,
  submitLabel,
  submittingLabel,
  onCancel,
}: FormActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? submittingLabel : submitLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isSubmitting}
        onClick={onCancel}
      >
        Hủy
      </Button>
    </div>
  );
}

function getSubmissionError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

interface StudentFormProps {
  onCancel: () => void;
  onSaved: () => void;
}

export function CreateStudentForm({ onCancel, onSaved }: StudentFormProps) {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentInput>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      fullName: "",
      username: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (input) => {
    setSubmissionError(null);

    try {
      await createStudentAccount(input);
      onSaved();
    } catch (error) {
      setSubmissionError(getSubmissionError(error));
    }
  });

  return (
    <section className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Tạo tài khoản học sinh</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Vai trò học sinh được gán tự động trên máy chủ.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="create-full-name">Họ và tên</Label>
          <Input
            id="create-full-name"
            autoComplete="name"
            autoFocus
            required
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={
              errors.fullName ? "create-full-name-error" : undefined
            }
            {...register("fullName")}
          />
          {errors.fullName && (
            <p id="create-full-name-error" className="text-destructive text-sm">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="create-username">Tên đăng nhập</Label>
          <Input
            id="create-username"
            autoComplete="off"
            autoCapitalize="none"
            required
            aria-invalid={Boolean(errors.username)}
            aria-describedby={
              errors.username ? "create-username-error" : undefined
            }
            {...register("username")}
          />
          {errors.username && (
            <p id="create-username-error" className="text-destructive text-sm">
              {errors.username.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="create-password">Mật khẩu ban đầu</Label>
          <Input
            id="create-password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "create-password-error" : undefined
            }
            {...register("password")}
          />
          {errors.password && (
            <p id="create-password-error" className="text-destructive text-sm">
              {errors.password.message}
            </p>
          )}
        </div>

        {submissionError && (
          <p role="alert" className="text-destructive text-sm">
            {submissionError}
          </p>
        )}

        <FormActions
          isSubmitting={isSubmitting}
          submitLabel="Tạo học sinh"
          submittingLabel="Đang tạo..."
          onCancel={onCancel}
        />
      </form>
    </section>
  );
}

interface EditStudentFormProps extends StudentFormProps {
  student: StudentAccount;
}

export function EditStudentForm({
  student,
  onCancel,
  onSaved,
}: EditStudentFormProps) {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateStudentInput>({
    resolver: zodResolver(updateStudentSchema),
    defaultValues: {
      fullName: student.fullName,
      username: student.username,
    },
  });

  const onSubmit = handleSubmit(async (input) => {
    setSubmissionError(null);

    try {
      await updateStudentAccount(student.id, input);
      onSaved();
    } catch (error) {
      setSubmissionError(getSubmissionError(error));
    }
  });

  return (
    <section className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm">
      <h2 className="text-xl font-semibold">Chỉnh sửa học sinh</h2>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="edit-full-name">Họ và tên</Label>
          <Input
            id="edit-full-name"
            autoComplete="name"
            autoFocus
            required
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={
              errors.fullName ? "edit-full-name-error" : undefined
            }
            {...register("fullName")}
          />
          {errors.fullName && (
            <p id="edit-full-name-error" className="text-destructive text-sm">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-username">Tên đăng nhập</Label>
          <Input
            id="edit-username"
            autoComplete="off"
            autoCapitalize="none"
            required
            aria-invalid={Boolean(errors.username)}
            aria-describedby={
              errors.username ? "edit-username-error" : undefined
            }
            {...register("username")}
          />
          {errors.username && (
            <p id="edit-username-error" className="text-destructive text-sm">
              {errors.username.message}
            </p>
          )}
        </div>

        {submissionError && (
          <p role="alert" className="text-destructive text-sm">
            {submissionError}
          </p>
        )}

        <FormActions
          isSubmitting={isSubmitting}
          submitLabel="Lưu thay đổi"
          submittingLabel="Đang lưu..."
          onCancel={onCancel}
        />
      </form>
    </section>
  );
}

interface ResetPasswordFormProps extends StudentFormProps {
  student: StudentAccount;
}

export function ResetPasswordForm({
  student,
  onCancel,
  onSaved,
}: ResetPasswordFormProps) {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetStudentPasswordInput>({
    resolver: zodResolver(resetStudentPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (input) => {
    setSubmissionError(null);

    try {
      await resetStudentAccountPassword(student.id, input);
      onSaved();
    } catch (error) {
      setSubmissionError(getSubmissionError(error));
    }
  });

  return (
    <section className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Đặt lại mật khẩu</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Tài khoản: {student.fullName} (@{student.username})
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="reset-password">Mật khẩu mới</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "reset-password-error" : undefined
            }
            {...register("password")}
          />
          {errors.password && (
            <p id="reset-password-error" className="text-destructive text-sm">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-password-confirmation">Nhập lại mật khẩu</Label>
          <Input
            id="reset-password-confirmation"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword
                ? "reset-password-confirmation-error"
                : undefined
            }
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p
              id="reset-password-confirmation-error"
              className="text-destructive text-sm"
            >
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {submissionError && (
          <p role="alert" className="text-destructive text-sm">
            {submissionError}
          </p>
        )}

        <FormActions
          isSubmitting={isSubmitting}
          submitLabel="Đổi mật khẩu"
          submittingLabel="Đang cập nhật..."
          onCancel={onCancel}
        />
      </form>
    </section>
  );
}
