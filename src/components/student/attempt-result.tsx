"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

import { ResultDetailSkeleton } from "@/components/shared/loading-skeletons";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchStudentExamAttemptResult } from "@/lib/api/student-exams";
import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { EXAM_SCORING, PART_TWO_STATEMENTS } from "@/lib/constants/exam";
import {
  formatDuration,
  scoreFormatter,
  vietnamDateTimeFormatter as dateTimeFormatter,
} from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { StudentExamAttemptResult } from "@/types/exam-attempt";

interface AttemptResultProps {
  examId: string;
  attemptId: string;
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

  return "Không thể tải kết quả bài làm. Vui lòng thử lại.";
}

function formatBooleanAnswer(answer: boolean | null): string {
  return answer === null ? "Chưa trả lời" : answer ? "Đúng" : "Sai";
}

function CorrectnessBadge({ isCorrect }: { isCorrect: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        isCorrect
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
      )}
    >
      {isCorrect ? "Chính xác" : "Chưa chính xác"}
    </span>
  );
}

function DynamicAnswerReview({
  result,
  hideEssayImages,
}: {
  result: StudentExamAttemptResult;
  hideEssayImages: boolean;
}) {
  const review = result.dynamicAnswerReview;
  const structure = result.exam.structureSnapshot;

  if (!review || !structure) {
    return null;
  }

  return (
    <section aria-labelledby="answer-review-heading" className="space-y-6">
      <div className="border-border border-b pb-4">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          Chi tiết bài làm
        </p>
        <h2
          id="answer-review-heading"
          className="mt-1 text-2xl font-bold tracking-tight"
        >
          Đối chiếu đáp án
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Câu hỏi được hiển thị trong tệp đề thi PDF.
        </p>
      </div>

      {structure.sections.map((section) => (
        <div key={section.id} className="space-y-3">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {section.questions.map((question, questionIndex) => {
              const item = review.questionsById[question.id];

              if (!item) {
                return null;
              }

              if (item.type === "ESSAY_IMAGE") {
                if (hideEssayImages) {
                  return null;
                }

                return (
                  <div
                    key={question.id}
                    className="border-border bg-card rounded-xl border p-4 shadow-xs lg:col-span-2"
                  >
                    <p className="font-semibold">Câu {questionIndex + 1}</p>
                    {item.score === undefined ? (
                      <p className="text-muted-foreground mt-1 text-sm">
                        Bài tự luận chưa được chấm.
                      </p>
                    ) : (
                      <p className="text-primary mt-1 font-medium tabular-nums">
                        Điểm: {scoreFormatter.format(item.score)} /{" "}
                        {scoreFormatter.format(
                          question.maxScoreHundredths / 100,
                        )}
                      </p>
                    )}
                    {item.studentAnswer.images.length > 0 ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {item.studentAnswer.images.map((image, imageIndex) => (
                          <figure
                            key={image.publicId}
                            className="border-border bg-muted/20 overflow-hidden rounded-lg border"
                          >
                            <Image
                              src={image.secureUrl}
                              alt={`Ảnh bài làm ${imageIndex + 1}`}
                              width={image.width}
                              height={image.height}
                              className="h-48 w-full object-contain"
                            />
                            <figcaption className="text-muted-foreground truncate px-3 py-2 text-xs">
                              {image.originalFilename}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-3 text-sm">
                        Không có ảnh bài làm đã nộp.
                      </p>
                    )}
                  </div>
                );
              }

              if (item.type === "TRUE_FALSE") {
                return (
                  <div
                    key={question.id}
                    className="border-border bg-card rounded-xl border p-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">Câu {questionIndex + 1}</p>
                      <p className="text-muted-foreground text-sm">
                        {item.correctStatementCount}/4 ý đúng
                        {item.score !== undefined
                          ? ` · ${scoreFormatter.format(item.score)} điểm`
                          : ""}
                      </p>
                    </div>
                    <div className="divide-border mt-3 divide-y">
                      {PART_TWO_STATEMENTS.map((statement) => {
                        const statementReview = item.statements[statement];
                        const comparison = `${formatBooleanAnswer(statementReview.studentAnswer)} -> ${formatBooleanAnswer(statementReview.correctAnswer)}`;

                        return (
                          <div
                            key={statement}
                            className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 py-2 text-sm"
                          >
                            <span className="font-semibold">{statement}</span>
                            <span className="text-muted-foreground">
                              {comparison}
                            </span>
                            <CorrectnessBadge
                              isCorrect={statementReview.isCorrect}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={question.id}
                  className="border-border bg-card rounded-xl border p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Câu {questionIndex + 1}</p>
                    <CorrectnessBadge isCorrect={item.isCorrect} />
                  </div>
                  <div className="text-muted-foreground mt-2 space-y-1 text-sm">
                    {item.type === "SINGLE_CHOICE" ? (
                      <>
                        <p>Bài làm: {item.studentAnswer ?? "Chưa trả lời"}</p>
                        <p>Đáp án đúng: {item.correctAnswer}</p>
                      </>
                    ) : (
                      <>
                        <p>
                          Bài làm: {item.studentDisplayAnswer ?? "Chưa trả lời"}
                        </p>
                        <p>Đáp án đúng: {item.correctDisplayAnswer}</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

export function PendingGradingSummary({
  result,
}: {
  result: StudentExamAttemptResult;
}) {
  if (result.gradingStatus !== EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL) {
    return null;
  }

  return (
    <section className="border-amber-300 bg-amber-50/70 rounded-2xl border p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          className="mt-1 size-2.5 shrink-0 rounded-full bg-amber-500"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-lg font-semibold">Bài tự luận đang chờ chấm</h2>
          {result.objectiveScore && (
            <p className="mt-2 font-medium tabular-nums">
              Điểm phần đã chấm tự động:{" "}
              {scoreFormatter.format(result.objectiveScore.earned)} /{" "}
              {scoreFormatter.format(result.objectiveScore.maximum)}
            </p>
          )}
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            Điểm tổng kết chưa có cho đến khi phần tự luận được chấm.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ScoreSummary({ result }: { result: StudentExamAttemptResult }) {
  if (!result.score) {
    return null;
  }

  const sections =
    result.exam.structureSnapshot && result.score.sectionsById
      ? result.exam.structureSnapshot.sections.map((section) => ({
          id: section.id,
          label: section.title,
          score: result.score?.sectionsById?.[section.id] ?? 0,
          maximum:
            section.questions.reduce(
              (total, question) => total + question.maxScoreHundredths,
              0,
            ) / 100,
        }))
      : result.score.sections
        ? [
            {
              id: "part-one",
              label: "Phần I",
              score: result.score.sections.partOne,
              maximum: EXAM_SCORING.partOneMaximum,
            },
            {
              id: "part-two",
              label: "Phần II",
              score: result.score.sections.partTwo,
              maximum: EXAM_SCORING.partTwoMaximum,
            },
            {
              id: "part-three",
              label: "Phần III",
              score: result.score.sections.partThree,
              maximum: EXAM_SCORING.partThreeMaximum,
            },
          ]
        : [];

  return (
    <section aria-labelledby="score-heading" className="space-y-3">
      <div className="border-primary/20 from-primary/10 via-background to-background rounded-2xl border bg-linear-to-br p-6 sm:p-8">
        <p
          id="score-heading"
          className="text-primary text-xs font-semibold tracking-widest uppercase"
        >
          Tổng điểm
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
          {scoreFormatter.format(result.score.total)} /{" "}
          <span className="text-muted-foreground text-2xl font-medium sm:text-3xl">
            {EXAM_SCORING.totalMaximum}
          </span>
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.id}
            className="border-border bg-card rounded-xl border p-4 shadow-xs"
          >
            <p className="text-muted-foreground text-sm">{section.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {scoreFormatter.format(section.score)} / {section.maximum}
            </p>
          </div>
        ))}
      </div>
      {result.essayScores && result.essayScores.length > 0 && (
        <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
          <p className="font-semibold">Điểm tự luận</p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {result.essayScores.map((item) => (
              <p key={item.questionId} className="tabular-nums">
                {(() => {
                  const identity = result.exam.structureSnapshot?.sections
                    .flatMap((section) =>
                      section.questions.map((question, questionIndex) => ({
                        question,
                        questionIndex,
                      })),
                    )
                    .find(({ question }) => question.id === item.questionId);

                  return `Câu ${(identity?.questionIndex ?? 0) + 1}: ${scoreFormatter.format(item.score)} / ${scoreFormatter.format(item.maximum)}`;
                })()}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function AnswerReview({
  result,
  hideEssayImages = false,
}: {
  result: StudentExamAttemptResult;
  hideEssayImages?: boolean;
}) {
  if (result.dynamicAnswerReview && result.exam.structureSnapshot) {
    return (
      <DynamicAnswerReview result={result} hideEssayImages={hideEssayImages} />
    );
  }

  const review = result.answerReview;

  if (!review) {
    return null;
  }

  return (
    <section aria-labelledby="answer-review-heading" className="space-y-6">
      <div className="border-border border-b pb-4">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          Chi tiết bài làm
        </p>
        <h2
          id="answer-review-heading"
          className="mt-1 text-2xl font-bold tracking-tight"
        >
          Đối chiếu đáp án
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Câu hỏi được hiển thị trong tệp đề thi PDF.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Phần I</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {review.partOne.map((item, index) => (
            <div
              key={index}
              className="border-border bg-card rounded-xl border p-4 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Câu {index + 1}</p>
                <CorrectnessBadge isCorrect={item.isCorrect} />
              </div>
              <div className="text-muted-foreground mt-2 space-y-1 text-sm">
                <p>Bài làm: {item.studentAnswer ?? "Chưa trả lời"}</p>
                <p>Đáp án đúng: {item.correctAnswer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Phần II</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {review.partTwo.map((question, questionIndex) => (
            <div
              key={questionIndex}
              className="border-border bg-card rounded-xl border p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Câu {questionIndex + 1}</p>
                <p className="text-muted-foreground text-sm">
                  {question.correctStatementCount}/4 ý đúng
                  {question.score !== undefined &&
                    ` · ${scoreFormatter.format(question.score)} điểm`}
                </p>
              </div>
              <div className="divide-border mt-3 divide-y">
                {PART_TWO_STATEMENTS.map((statement) => {
                  const item = question.statements[statement];

                  return (
                    <div
                      key={statement}
                      className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 py-2 text-sm"
                    >
                      <span className="font-semibold">{statement}</span>
                      <span className="text-muted-foreground">
                        {formatBooleanAnswer(item.studentAnswer)} →{" "}
                        {formatBooleanAnswer(item.correctAnswer)}
                      </span>
                      <CorrectnessBadge isCorrect={item.isCorrect} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Phần III</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {review.partThree.map((item, index) => (
            <div
              key={index}
              className="border-border bg-card rounded-xl border p-4 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Câu {index + 1}</p>
                <CorrectnessBadge isCorrect={item.isCorrect} />
              </div>
              <div className="text-muted-foreground mt-2 space-y-1 text-sm">
                <p>Bài làm: {item.studentDisplayAnswer ?? "Chưa trả lời"}</p>
                <p>Đáp án đúng: {item.correctDisplayAnswer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AttemptResult({ examId, attemptId }: AttemptResultProps) {
  const [result, setResult] = useState<StudentExamAttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    void fetchStudentExamAttemptResult(examId, attemptId)
      .then((response) => {
        if (isCurrent) {
          setResult(response.data.result);
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
  }, [attemptId, examId, refreshVersion]);

  if (error) {
    return (
      <div className="border-border space-y-4 rounded-xl border p-6">
        <p role="alert" className="text-destructive">
          {error}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError(null);
              setRefreshVersion((version) => version + 1);
            }}
          >
            Thử lại
          </Button>
          <Button asChild variant="outline">
            <Link href="/student">Quay lại danh sách đề thi</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!result) {
    return <ResultDetailSkeleton label="Đang tải kết quả bài làm" />;
  }

  const wasAutoSubmitted =
    result.attempt.status === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED;

  return (
    <div className="space-y-8">
      <header className="border-border bg-card relative overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-7">
        <div
          className="bg-primary/80 absolute inset-y-0 left-0 w-1"
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-primary text-xs font-semibold tracking-widest uppercase">
            Kết quả bài làm
          </p>
          <span className="bg-muted text-muted-foreground inline-flex rounded-full px-3 py-1 text-xs font-medium">
            Lần làm {result.attempt.attemptNumber}
          </span>
        </div>
        <h1 className="mt-3 max-w-4xl break-words text-2xl font-bold tracking-tight sm:text-3xl">
          {result.exam.title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {wasAutoSubmitted ? "Tự động nộp khi hết giờ" : "Đã nộp bài chủ động"}
        </p>
        <dl className="border-border mt-6 grid gap-4 border-t pt-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Bắt đầu</dt>
            <dd className="mt-1 font-medium">
              {dateTimeFormatter.format(new Date(result.attempt.startedAt))}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Nộp bài</dt>
            <dd className="mt-1 font-medium">
              {dateTimeFormatter.format(new Date(result.attempt.submittedAt))}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Thời gian làm bài</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {formatDuration(result.attempt.timeUsedSeconds)}
            </dd>
          </div>
        </dl>
      </header>

      <ScoreSummary result={result} />
      <PendingGradingSummary result={result} />

      {!result.visibility.score && !result.visibility.answers && (
        <div className="border-border bg-muted/50 rounded-xl border p-6 text-center text-sm leading-6">
          Bài làm đã được ghi nhận. Kết quả hiện chưa được công bố.
        </div>
      )}

      {!result.visibility.score && result.visibility.answers && (
        <div className="border-border bg-muted/50 rounded-xl border p-4 text-center text-sm">
          Điểm số hiện chưa được công bố.
        </div>
      )}

      {result.visibility.score && !result.visibility.answers && (
        <div className="border-border bg-muted/50 rounded-xl border p-4 text-center text-sm">
          Đáp án và đối chiếu từng câu hiện chưa được công bố.
        </div>
      )}

      <AnswerReview result={result} />

      <div className="border-border border-t pt-6">
        <Button asChild variant="outline">
          <Link href="/student">Quay lại danh sách đề thi</Link>
        </Button>
      </div>
    </div>
  );
}
