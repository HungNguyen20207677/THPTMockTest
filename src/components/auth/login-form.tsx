"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_HOME } from "@/lib/constants/roles";
import {
  credentialsSchema,
  type CredentialsInput,
} from "@/lib/validations/auth";

const GENERIC_LOGIN_ERROR =
  "Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.";

export function LoginForm() {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsInput>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (credentials) => {
    setSubmissionError(null);

    try {
      const result = await signIn("credentials", {
        ...credentials,
        redirect: false,
        redirectTo: "/",
      });

      if (!result?.ok || result.error) {
        setSubmissionError(GENERIC_LOGIN_ERROR);
        return;
      }

      const session = await getSession();

      if (!session) {
        setSubmissionError(GENERIC_LOGIN_ERROR);
        return;
      }

      window.location.replace(ROLE_HOME[session.user.role]);
    } catch {
      setSubmissionError("Không thể đăng nhập lúc này. Vui lòng thử lại sau.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="username">Tên đăng nhập</Label>
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          required
          aria-invalid={Boolean(errors.username)}
          aria-describedby={errors.username ? "username-error" : undefined}
          {...register("username")}
        />
        {errors.username && (
          <p id="username-error" className="text-destructive text-sm">
            {errors.username.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-destructive text-sm">
            {errors.password.message}
          </p>
        )}
      </div>

      {submissionError && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm leading-6"
        >
          {submissionError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
