"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ResultDetailSkeleton } from "@/components/shared/loading-skeletons";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchStudentExamAttemptResult } from "@/lib/api/student-exams";
import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
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
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        isCorrect
          ? "bg-emerald-100 text-emerald-800"
          : "bg-red-100 text-red-800",
      )}
    >
      {isCorrect ? "Chính xác" : "Chưa chính xác"}
    </span>
  );
}

export function ScoreSummary({ result }: { result: StudentExamAttemptResult }) {
  if (!result.score) {
    return null;
  }

  const sections = [
    {
      label: "Phần I",
      score: result.score.sections.partOne,
      maximum: EXAM_SCORING.partOneMaximum,
    },
    {
      label: "Phần II",
      score: result.score.sections.partTwo,
      maximum: EXAM_SCORING.partTwoMaximum,
    },
    {
      label: "Phần III",
      score: result.score.sections.partThree,
      maximum: EXAM_SCORING.partThreeMaximum,
    },
  ];

  return (
    <section aria-labelledby="score-heading" className="space-y-4">
      <div className="border-primary/20 bg-primary/5 rounded-xl border p-6 text-center">
        <p id="score-heading" className="text-muted-foreground text-sm">
          Tổng điểm
        </p>
        <p className="text-primary mt-1 text-4xl font-bold tabular-nums">
          {scoreFormatter.format(result.score.total)} /{" "}
          {EXAM_SCORING.totalMaximum}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.label}
            className="border-border bg-background rounded-lg border p-4"
          >
            <p className="text-muted-foreground text-sm">{section.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {scoreFormatter.format(section.score)} / {section.maximum}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AnswerReview({ result }: { result: StudentExamAttemptResult }) {
  const review = result.answerReview;

  if (!review) {
    return null;
  }

  return (
    <section aria-labelledby="answer-review-heading" className="space-y-8">
      <div>
        <h2 id="answer-review-heading" className="text-2xl font-bold">
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
            <div key={index} className="border-border rounded-lg border p-3">
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
              className="border-border rounded-lg border p-4"
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
            <div key={index} className="border-border rounded-lg border p-3">
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
      <header className="border-border bg-background rounded-xl border p-6 shadow-sm">
        <p className="text-primary text-sm font-semibold">KẾT QUẢ BÀI LÀM</p>
        <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">
          {result.exam.title}
        </h1>
        <p className="text-muted-foreground mt-2">
          Lần làm {result.attempt.attemptNumber} ·{" "}
          {wasAutoSubmitted ? "Tự động nộp khi hết giờ" : "Đã nộp bài"}
        </p>
        <div className="text-muted-foreground mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <p>
            Bắt đầu:{" "}
            {dateTimeFormatter.format(new Date(result.attempt.startedAt))}
          </p>
          <p>
            Nộp bài:{" "}
            {dateTimeFormatter.format(new Date(result.attempt.submittedAt))}
          </p>
          <p>
            Thời gian làm bài: {formatDuration(result.attempt.timeUsedSeconds)}
          </p>
        </div>
      </header>

      <ScoreSummary result={result} />

      {!result.visibility.score && !result.visibility.answers && (
        <div className="bg-muted rounded-xl p-6 text-center text-sm leading-6">
          Bài làm đã được ghi nhận. Kết quả hiện chưa được công bố.
        </div>
      )}

      {!result.visibility.score && result.visibility.answers && (
        <div className="bg-muted rounded-xl p-4 text-center text-sm">
          Điểm số hiện chưa được công bố.
        </div>
      )}

      {result.visibility.score && !result.visibility.answers && (
        <div className="bg-muted rounded-xl p-4 text-center text-sm">
          Đáp án và đối chiếu từng câu hiện chưa được công bố.
        </div>
      )}

      <AnswerReview result={result} />

      <Button asChild variant="outline">
        <Link href="/student">Quay lại danh sách đề thi</Link>
      </Button>
    </div>
  );
}
