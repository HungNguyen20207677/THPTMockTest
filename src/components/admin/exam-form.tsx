"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { ShortAnswerBubbleInput } from "@/components/exam/short-answer-bubble-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api/client";
import { createExamRecord, fetchExam, updateExamRecord } from "@/lib/api/exams";
import {
  EXAM_STATUSES,
  EXAM_STATUS,
  EXAM_STRUCTURE,
  PART_ONE_CHOICES,
  PART_TWO_STATEMENTS,
} from "@/lib/constants/exam";
import {
  canonicalShortAnswerToSlots,
  createEmptyShortAnswerSlots,
} from "@/lib/exam/short-answer";
import {
  examEditorSchema,
  type ExamEditorInput,
  type ExamEditorOutput,
} from "@/lib/validations/exam";
import { getExamPdfValidationError } from "@/lib/validations/exam-pdf";
import type { ExamDetail, ExamPdf } from "@/types/exam";

const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50";

const statusLabels = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  HIDDEN: "Đã ẩn",
} as const;

interface ExamFormProps {
  mode: "create" | "edit";
  examId?: string;
}

function createEmptyEditorValues(): ExamEditorInput {
  return {
    title: "",
    description: "",
    status: EXAM_STATUS.DRAFT,
    settings: {
      allowRetake: true,
      showScoreAfterSubmission: true,
      showAnswersAfterSubmission: false,
    },
    answerKey: {
      partOne: Array.from(
        { length: EXAM_STRUCTURE.partOneQuestions },
        (): "" => "",
      ),
      partTwo: Array.from({ length: EXAM_STRUCTURE.partTwoQuestions }, () => ({
        a: null,
        b: null,
        c: null,
        d: null,
      })),
      partThree: Array.from(
        { length: EXAM_STRUCTURE.partThreeQuestions },
        createEmptyShortAnswerSlots,
      ),
    },
  };
}

function toEditorValues(exam: ExamDetail): ExamEditorInput {
  return {
    title: exam.title,
    description: exam.description ?? "",
    status: exam.status,
    settings: { ...exam.settings },
    answerKey: {
      partOne: [...exam.answerKey.partOne],
      partTwo: exam.answerKey.partTwo.map((answer) => ({ ...answer })),
      partThree: exam.answerKey.partThree.map(
        (answer) =>
          canonicalShortAnswerToSlots(answer) ?? createEmptyShortAnswerSlots(),
      ),
    },
  };
}

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể lưu đề thi. Vui lòng thử lại.";
}

export function ExamForm({ mode, examId }: ExamFormProps) {
  const router = useRouter();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentPdf, setCurrentPdf] = useState<ExamPdf | null>(null);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(null);
  const [isContentLocked, setIsContentLocked] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExamEditorInput, unknown, ExamEditorOutput>({
    resolver: zodResolver(examEditorSchema),
    defaultValues: createEmptyEditorValues(),
  });

  useEffect(() => {
    if (mode !== "edit" || !examId) {
      return;
    }

    let isCurrent = true;

    void fetchExam(examId)
      .then((response) => {
        if (isCurrent) {
          reset(toEditorValues(response.data.exam));
          setCurrentPdf(response.data.exam.pdf);
          setCurrentUpdatedAt(response.data.exam.updatedAt);
          setIsContentLocked(response.data.exam.hasAttempts);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadError(getRequestError(error));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [examId, mode, reset]);

  function handlePdfChange(file: File | undefined): boolean {
    if (!file) {
      setPdfFile(null);
      setFileError(null);
      return true;
    }

    const validationError = getExamPdfValidationError(file);

    if (validationError) {
      setPdfFile(null);
      setFileError(validationError);
      return false;
    }

    setPdfFile(file);
    setFileError(null);
    return true;
  }

  const onSubmit = handleSubmit(async (input) => {
    setSubmissionError(null);

    if (mode === "create" && !pdfFile) {
      setFileError("Vui lòng chọn tệp PDF của đề thi.");
      return;
    }

    try {
      if (mode === "create" && pdfFile) {
        await createExamRecord(input, pdfFile);
      } else if (mode === "edit" && examId && currentUpdatedAt) {
        await updateExamRecord(
          examId,
          { ...input, expectedUpdatedAt: currentUpdatedAt },
          pdfFile ?? undefined,
        );
      } else {
        throw new Error("Invalid exam form state.");
      }

      router.push("/admin/exams");
      router.refresh();
    } catch (error) {
      setSubmissionError(getRequestError(error));
      requestAnimationFrame(() =>
        document.getElementById("exam-submission-error")?.focus(),
      );
    }
  });

  if (isLoading) {
    return (
      <p className="text-muted-foreground py-10 text-center" aria-live="polite">
        Đang tải đề thi...
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="border-border space-y-4 rounded-xl border p-6">
        <p role="alert" className="text-destructive">
          {loadError}
        </p>
        <Button asChild variant="outline">
          <Link href="/admin/exams">Quay lại danh sách</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <fieldset disabled={isSubmitting} className="contents">
        <section className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Thông tin đề thi</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Cấu trúc cố định: {EXAM_STRUCTURE.totalQuestions} câu, thời gian{" "}
              {EXAM_STRUCTURE.durationMinutes} phút.
            </p>
            {isContentLocked && (
              <p className="mt-2 text-sm font-medium text-amber-700">
                Đề thi đã có lượt làm. Bạn vẫn có thể sửa thông tin và thiết
                lập, nhưng tệp PDF và đáp án đã được khóa.
              </p>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="exam-title">Tiêu đề</Label>
              <Input
                id="exam-title"
                autoFocus
                required
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? "exam-title-error" : undefined}
                {...register("title")}
              />
              {errors.title && (
                <p id="exam-title-error" className="text-destructive text-sm">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="exam-description">Mô tả (không bắt buộc)</Label>
              <Textarea
                id="exam-description"
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description ? "exam-description-error" : undefined
                }
                {...register("description")}
              />
              {errors.description && (
                <p
                  id="exam-description-error"
                  className="text-destructive text-sm"
                >
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="exam-status">Trạng thái</Label>
              <select
                id="exam-status"
                className={selectClassName}
                {...register("status")}
              >
                {EXAM_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exam-pdf">
                {mode === "create" ? "Tệp đề thi PDF" : "Thay tệp PDF"}
              </Label>
              <Input
                id="exam-pdf"
                type="file"
                accept="application/pdf,.pdf"
                required={mode === "create"}
                disabled={isContentLocked}
                aria-invalid={Boolean(fileError)}
                aria-describedby={
                  fileError ? "exam-pdf-error" : "exam-pdf-help"
                }
                onChange={(event) => {
                  if (!handlePdfChange(event.target.files?.[0])) {
                    event.currentTarget.value = "";
                  }
                }}
              />
              <p id="exam-pdf-help" className="text-muted-foreground text-xs">
                {isContentLocked
                  ? "Không thể thay tệp PDF sau khi đề đã có lượt làm."
                  : "Chỉ nhận PDF, tối đa 15 MB."}
              </p>
              {currentPdf && (
                <p className="text-sm">
                  Tệp hiện tại:{" "}
                  <a
                    className="text-primary underline underline-offset-4"
                    href={currentPdf.secureUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {currentPdf.originalFilename}
                  </a>
                </p>
              )}
              {fileError && (
                <p id="exam-pdf-error" className="text-destructive text-sm">
                  {fileError}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="border-border bg-background space-y-4 rounded-xl border p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Thiết lập</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="border-border flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                {...register("settings.allowRetake")}
              />
              <span>Cho phép làm lại</span>
            </label>
            <label className="border-border flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                {...register("settings.showScoreAfterSubmission")}
              />
              <span>Hiện điểm sau khi nộp</span>
            </label>
            <label className="border-border flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                {...register("settings.showAnswersAfterSubmission")}
              />
              <span>Hiện đáp án sau khi nộp</span>
            </label>
          </div>
        </section>

        <section className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Phần I - Trắc nghiệm</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Chọn một đáp án A, B, C hoặc D cho mỗi câu.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from(
              { length: EXAM_STRUCTURE.partOneQuestions },
              (_, questionIndex) => {
                const answerError =
                  errors.answerKey?.partOne?.[questionIndex]?.message;
                const errorId = `part-one-${questionIndex}-error`;

                return (
                  <div key={questionIndex} className="space-y-2">
                    <Label htmlFor={`part-one-${questionIndex}`}>
                      Câu {questionIndex + 1}
                    </Label>
                    <select
                      id={`part-one-${questionIndex}`}
                      className={selectClassName}
                      aria-invalid={Boolean(answerError)}
                      aria-describedby={answerError ? errorId : undefined}
                      disabled={isContentLocked}
                      {...register(
                        `answerKey.partOne.${questionIndex}` as const,
                      )}
                    >
                      <option value="">Chọn</option>
                      {PART_ONE_CHOICES.map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                    {answerError && (
                      <p
                        id={errorId}
                        role="alert"
                        className="text-destructive text-sm"
                      >
                        {answerError}
                      </p>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </section>

        <section className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Phần II - Đúng/Sai</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Chọn Đúng hoặc Sai cho từng ý a, b, c, d.
            </p>
          </div>
          <div className="space-y-4">
            {Array.from(
              { length: EXAM_STRUCTURE.partTwoQuestions },
              (_, questionIndex) => (
                <fieldset
                  key={questionIndex}
                  className="border-border rounded-lg border p-4"
                  disabled={isContentLocked}
                >
                  <legend className="px-1 font-medium">
                    Câu {questionIndex + 1}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {PART_TWO_STATEMENTS.map((statement) => (
                      <Controller
                        key={statement}
                        control={control}
                        name={
                          `answerKey.partTwo.${questionIndex}.${statement}` as const
                        }
                        render={({ field, fieldState }) => {
                          const errorId = `part-two-${questionIndex}-${statement}-error`;

                          return (
                            <div className="space-y-2">
                              <Label
                                htmlFor={`part-two-${questionIndex}-${statement}`}
                              >
                                Ý {statement}
                              </Label>
                              <select
                                id={`part-two-${questionIndex}-${statement}`}
                                ref={field.ref}
                                name={field.name}
                                className={selectClassName}
                                value={
                                  field.value === null
                                    ? ""
                                    : field.value
                                      ? "true"
                                      : "false"
                                }
                                aria-invalid={Boolean(fieldState.error)}
                                aria-describedby={
                                  fieldState.error ? errorId : undefined
                                }
                                onBlur={field.onBlur}
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.value === ""
                                      ? null
                                      : event.target.value === "true",
                                  )
                                }
                              >
                                <option value="">Chọn</option>
                                <option value="true">Đúng</option>
                                <option value="false">Sai</option>
                              </select>
                              {fieldState.error && (
                                <p
                                  id={errorId}
                                  role="alert"
                                  className="text-destructive text-sm"
                                >
                                  {fieldState.error.message}
                                </p>
                              )}
                            </div>
                          );
                        }}
                      />
                    ))}
                  </div>
                </fieldset>
              ),
            )}
          </div>
        </section>

        <section className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Phần III - Trả lời ngắn</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Tô tối đa 4 ô ký tự. Dấu phẩy hiển thị theo mẫu Việt Nam và được
              lưu nội bộ bằng dấu chấm.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from(
              { length: EXAM_STRUCTURE.partThreeQuestions },
              (_, questionIndex) => (
                <Controller
                  key={questionIndex}
                  control={control}
                  name={`answerKey.partThree.${questionIndex}` as const}
                  render={({ field, fieldState }) => (
                    <ShortAnswerBubbleInput
                      value={field.value}
                      onChange={field.onChange}
                      label={`Câu ${questionIndex + 1}`}
                      error={fieldState.error?.message}
                      disabled={isSubmitting || isContentLocked}
                      inputRef={field.ref}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              ),
            )}
          </div>
        </section>
      </fieldset>

      {submissionError && (
        <p
          id="exam-submission-error"
          tabIndex={-1}
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {submissionError}
        </p>
      )}

      <div className="bg-background border-border sticky bottom-0 flex flex-wrap justify-end gap-2 border-t py-4">
        {isSubmitting ? (
          <Button type="button" variant="outline" disabled>
            Hủy
          </Button>
        ) : (
          <Button asChild type="button" variant="outline">
            <Link href="/admin/exams">Hủy</Link>
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Đang lưu đề thi..."
            : mode === "create"
              ? "Tạo đề thi"
              : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
