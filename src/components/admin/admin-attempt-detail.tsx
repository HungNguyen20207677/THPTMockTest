"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

import {
  AnswerReview,
  ScoreSummary,
} from "@/components/student/attempt-result";
import { ResultDetailSkeleton } from "@/components/shared/loading-skeletons";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/lib/api/client";
import {
  fetchAdminAttemptDetail,
  updateAdminManualEssayGrading,
} from "@/lib/api/reporting";
import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import {
  formatDuration,
  scoreFormatter,
  vietnamDateTimeFormatter,
} from "@/lib/formatting";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import type { ManualEssayScore } from "@/types/exam-attempt";
import type { StudentExamAttemptResult } from "@/types/exam-attempt";
import type { AdminAttemptDetail } from "@/types/reporting";

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể tải chi tiết lượt làm bài. Vui lòng thử lại.";
}

function scoreHundredthsToInput(score: number | null): string {
  return score === null ? "" : (score / 100).toFixed(2).replace(".", ",");
}

function parseScoreInput(
  input: string,
  maximumHundredths: number,
): { scoreHundredths: number | null; error?: string } {
  const value = input.trim();

  if (value === "") {
    return { scoreHundredths: null };
  }

  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value);

  if (!match) {
    return {
      scoreHundredths: null,
      error: "Điểm phải là số không âm và có tối đa 2 chữ số thập phân.",
    };
  }

  const scoreHundredths =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));

  if (
    !Number.isSafeInteger(scoreHundredths) ||
    scoreHundredths > maximumHundredths
  ) {
    return {
      scoreHundredths: null,
      error: `Điểm không được vượt quá ${scoreFormatter.format(maximumHundredths / 100)}.`,
    };
  }

  return { scoreHundredths };
}

function ManualEssayGradingSection({
  detail,
  onUpdated,
}: {
  detail: AdminAttemptDetail;
  onUpdated: (detail: AdminAttemptDetail) => void;
}) {
  const manualGrading = detail.manualGrading;
  const structure = detail.structureSnapshot;
  const [isEditingCorrection, setIsEditingCorrection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCorrectionConfirmation, setShowCorrectionConfirmation] =
    useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      manualGrading?.manualEssayScores.map((score) => [
        score.questionId,
        scoreHundredthsToInput(score.scoreHundredths),
      ]) ?? [],
    ),
  );

  if (!manualGrading || !structure || !detail.dynamicAnswerReview) {
    return null;
  }

  const questions = structure.sections.flatMap((section) =>
    section.questions.flatMap((question, questionIndex) =>
      question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE
        ? [{ section, question, questionIndex }]
        : [],
    ),
  );
  const parsedByQuestionId = Object.fromEntries(
    questions.map(({ question }) => [
      question.id,
      parseScoreInput(values[question.id] ?? "", question.maxScoreHundredths),
    ]),
  );
  const hasInvalidScore = Object.values(parsedByQuestionId).some(
    (parsed) => parsed.error,
  );
  const hasMissingScore = Object.values(parsedByQuestionId).some(
    (parsed) => parsed.scoreHundredths === null,
  );
  const isPending =
    detail.gradingStatus === EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL;
  const canEdit = isPending || isEditingCorrection;
  const expectedRevision = manualGrading.revision;
  const gradedCount = manualGrading.manualEssayScores.filter(
    (score) => score.scoreHundredths !== null,
  ).length;

  function getScores(): ManualEssayScore[] {
    return questions.map(({ question }) => ({
      questionId: question.id,
      scoreHundredths: parsedByQuestionId[question.id]?.scoreHundredths ?? null,
    }));
  }

  async function submit(action: "SAVE_DRAFT" | "FINALIZE" | "CORRECT") {
    setIsSaving(true);
    setFeedback(null);
    setSubmissionError(null);

    try {
      const response = await updateAdminManualEssayGrading(detail.attempt.id, {
        action,
        expectedRevision,
        manualEssayScores: getScores(),
        ...(action === "CORRECT" ? { confirmCorrection: true as const } : {}),
      });
      onUpdated(response.data.detail);
      setIsEditingCorrection(false);
      setShowCorrectionConfirmation(false);
      setFeedback(
        action === "SAVE_DRAFT"
          ? "Đã lưu điểm chấm"
          : action === "FINALIZE"
            ? "Đã hoàn tất chấm"
            : "Đã cập nhật điểm tự luận",
      );
    } catch (error) {
      setSubmissionError(
        error instanceof ApiClientError
          ? error.message
          : "Không thể lưu điểm chấm. Vui lòng thử lại.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="manual-grading-heading"
      className="border-border space-y-5 rounded-xl border p-5"
    >
      <AlertDialog
        open={showCorrectionConfirmation}
        onOpenChange={(open) => {
          if (!isSaving) setShowCorrectionConfirmation(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận sửa điểm tự luận</AlertDialogTitle>
            <AlertDialogDescription>
              Thay đổi điểm tự luận sẽ cập nhật điểm tổng và các thống kê liên
              quan của bài làm này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {submissionError && (
            <p role="alert" className="text-destructive text-sm">
              {submissionError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Quay lại</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving || hasInvalidScore || hasMissingScore}
              onClick={() => void submit("CORRECT")}
            >
              {isSaving ? "Đang cập nhật..." : "Xác nhận sửa điểm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="manual-grading-heading" className="text-xl font-bold">
            {isPending ? "Chấm bài tự luận" : "Điểm tự luận"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {isPending
              ? `Đã nhập điểm ${gradedCount}/${questions.length} câu.`
              : `Tổng điểm tự luận: ${scoreFormatter.format((manualGrading.essayScoreHundredths ?? 0) / 100)} / ${scoreFormatter.format(manualGrading.essayMaxScoreHundredths / 100)}`}
          </p>
        </div>
        {!isPending && !isEditingCorrection && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFeedback(null);
              setSubmissionError(null);
              setIsEditingCorrection(true);
            }}
          >
            Sửa điểm tự luận
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {questions.map(({ section, question, questionIndex }) => {
          const review = detail.dynamicAnswerReview?.questionsById[question.id];
          const parsed = parsedByQuestionId[question.id];

          if (
            !review ||
            review.type !== EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE
          ) {
            return null;
          }

          return (
            <article
              key={question.id}
              className="border-border space-y-4 rounded-lg border p-4"
            >
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  {section.title}
                </p>
                <h3 className="mt-1 font-semibold">Câu {questionIndex + 1}</h3>
                <p className="text-muted-foreground mt-1 text-sm tabular-nums">
                  Điểm tối đa:{" "}
                  {scoreFormatter.format(question.maxScoreHundredths / 100)}
                </p>
              </div>

              {review.studentAnswer.images.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {review.studentAnswer.images.map((image, imageIndex) => (
                    <figure
                      key={image.publicId}
                      className="border-border overflow-hidden rounded-lg border"
                    >
                      <Image
                        src={image.secureUrl}
                        alt={`Ảnh bài làm ${imageIndex + 1}`}
                        width={image.width}
                        height={image.height}
                        className="h-72 w-full object-contain lg:h-96"
                      />
                      <figcaption className="text-muted-foreground truncate px-3 py-2 text-xs">
                        {image.originalFilename}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="bg-muted rounded-lg px-4 py-3 text-sm font-medium">
                  Học sinh không tải lên bài làm
                </p>
              )}

              {canEdit ? (
                <div className="max-w-xs">
                  <label
                    htmlFor={`essay-score-${question.id}`}
                    className="text-sm font-medium"
                  >
                    Điểm:
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id={`essay-score-${question.id}`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={values[question.id] ?? ""}
                      aria-invalid={Boolean(parsed?.error)}
                      disabled={isSaving}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                    />
                    <span className="shrink-0 text-sm tabular-nums">
                      /{" "}
                      {scoreFormatter.format(question.maxScoreHundredths / 100)}
                    </span>
                  </div>
                  {parsed?.error && (
                    <p className="text-destructive mt-1 text-sm" role="alert">
                      {parsed.error}
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-medium tabular-nums">
                  Điểm:{" "}
                  {scoreFormatter.format((parsed?.scoreHundredths ?? 0) / 100)}{" "}
                  / {scoreFormatter.format(question.maxScoreHundredths / 100)}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {submissionError && !showCorrectionConfirmation && (
        <p role="alert" className="text-destructive text-sm">
          {submissionError}
        </p>
      )}
      {feedback && (
        <p role="status" className="text-sm font-medium text-emerald-700">
          {feedback}
        </p>
      )}

      {isPending && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving || hasInvalidScore}
            onClick={() => void submit("SAVE_DRAFT")}
          >
            {isSaving ? "Đang lưu..." : "Lưu điểm chấm"}
          </Button>
          <Button
            type="button"
            disabled={isSaving || hasInvalidScore || hasMissingScore}
            onClick={() => void submit("FINALIZE")}
          >
            {isSaving ? "Đang hoàn tất..." : "Hoàn tất chấm"}
          </Button>
        </div>
      )}

      {!isPending && isEditingCorrection && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => {
              setIsEditingCorrection(false);
              setSubmissionError(null);
              setValues(
                Object.fromEntries(
                  manualGrading.manualEssayScores.map((score) => [
                    score.questionId,
                    scoreHundredthsToInput(score.scoreHundredths),
                  ]),
                ),
              );
            }}
          >
            Hủy
          </Button>
          <Button
            type="button"
            disabled={isSaving || hasInvalidScore || hasMissingScore}
            onClick={() => setShowCorrectionConfirmation(true)}
          >
            Áp dụng điểm sửa
          </Button>
        </div>
      )}
    </section>
  );
}

export function AdminAttemptDetailView({ attemptId }: { attemptId: string }) {
  const [detail, setDetail] = useState<AdminAttemptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void fetchAdminAttemptDetail(attemptId)
      .then((response) => {
        if (isCurrent) {
          setDetail(response.data.detail);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (isCurrent) {
          setError(getRequestError(requestError));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [attemptId]);

  if (error) {
    return (
      <div className="border-border space-y-4 rounded-xl border p-6">
        <p role="alert" className="text-destructive">
          {error}
        </p>
        <Button asChild variant="outline">
          <Link href="/admin/results">Quay lại danh sách kết quả</Link>
        </Button>
      </div>
    );
  }

  if (!detail) {
    return <ResultDetailSkeleton label="Đang tải chi tiết lượt làm bài" />;
  }

  const isTerminal = detail.attempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS;
  const result: StudentExamAttemptResult | null =
    isTerminal &&
    detail.gradingStatus &&
    detail.attempt.submittedAt &&
    detail.attempt.timeUsedSeconds !== undefined
      ? {
          exam: {
            id: detail.exam?.id ?? "",
            title: detail.exam?.title ?? "Đề thi không còn tồn tại",
            structureSnapshot: detail.structureSnapshot,
          },
          attempt: {
            id: detail.attempt.id,
            attemptNumber: detail.attempt.attemptNumber,
            status: detail.attempt.status,
            startedAt: detail.attempt.startedAt,
            expiresAt: detail.attempt.expiresAt,
            submittedAt: detail.attempt.submittedAt,
            timeUsedSeconds: detail.attempt.timeUsedSeconds,
          },
          visibility: {
            score: true,
            answers: Boolean(detail.answerReview || detail.dynamicAnswerReview),
          },
          gradingStatus: detail.gradingStatus,
          objectiveScore: detail.objectiveScore,
          score: detail.score,
          answerReview: detail.answerReview,
          dynamicAnswerReview: detail.dynamicAnswerReview,
        }
      : null;

  return (
    <div className="space-y-8">
      <header className="border-border bg-background rounded-xl border p-6 shadow-sm">
        <p className="text-primary text-sm font-semibold">CHI TIẾT LƯỢT LÀM</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {detail.exam?.title ?? "Đề thi không còn tồn tại"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {detail.student ? (
            <Link
              className="underline-offset-4 hover:underline"
              href={`/admin/students/${detail.student.id}`}
            >
              {detail.student.fullName} (@{detail.student.username})
            </Link>
          ) : (
            "Tài khoản học sinh đã xóa"
          )}{" "}
          · Lần làm {detail.attempt.attemptNumber}
        </p>
        <div className="text-muted-foreground mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <p>
            Bắt đầu:{" "}
            {vietnamDateTimeFormatter.format(
              new Date(detail.attempt.startedAt),
            )}
          </p>
          <p>
            {detail.attempt.submittedAt
              ? `Nộp bài: ${vietnamDateTimeFormatter.format(new Date(detail.attempt.submittedAt))}`
              : "Chưa nộp bài"}
          </p>
          <p>
            {detail.attempt.timeUsedSeconds !== undefined
              ? `Thời gian làm bài: ${formatDuration(detail.attempt.timeUsedSeconds)}`
              : `Hết giờ: ${vietnamDateTimeFormatter.format(new Date(detail.attempt.expiresAt))}`}
          </p>
        </div>
      </header>

      {!isTerminal && (
        <div className="border-primary/20 bg-primary/5 rounded-xl border p-6">
          <h2 className="font-semibold">Lượt làm bài đang diễn ra</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Đáp án đang làm không được hiển thị cho quản trị viên. Kết quả sẽ có
            sau khi học sinh nộp bài hoặc hết giờ.
          </p>
        </div>
      )}

      {detail.gradingStatus === EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL && (
        <div className="border-amber-300 bg-amber-50 rounded-xl border p-6 text-amber-950">
          <h2 className="font-semibold">Chờ chấm tự luận</h2>
          {detail.objectiveScore && (
            <p className="mt-2 font-medium tabular-nums">
              Điểm phần đã chấm tự động: {detail.objectiveScore.earned} /{" "}
              {detail.objectiveScore.maximum}
            </p>
          )}
          <p className="mt-2 text-sm">Chưa có điểm tổng kết.</p>
        </div>
      )}

      {detail.gradingStatus === EXAM_ATTEMPT_GRADING_STATUS.COMPLETED &&
        detail.manualGrading &&
        detail.objectiveScore && (
          <div className="border-border bg-muted/40 rounded-xl border p-4">
            <p className="text-muted-foreground text-sm">
              Điểm phần chấm tự động
            </p>
            <p className="mt-1 font-semibold tabular-nums">
              {scoreFormatter.format(detail.objectiveScore.earned)} /{" "}
              {scoreFormatter.format(detail.objectiveScore.maximum)}
            </p>
          </div>
        )}

      {result && <ScoreSummary result={result} />}
      {detail.manualGrading && (
        <ManualEssayGradingSection detail={detail} onUpdated={setDetail} />
      )}
      {result && (
        <AnswerReview
          result={result}
          hideEssayImages={Boolean(detail.manualGrading)}
        />
      )}

      <Button asChild variant="outline">
        <Link href="/admin/results">Quay lại danh sách kết quả</Link>
      </Button>
    </div>
  );
}
