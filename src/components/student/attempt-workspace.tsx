"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { CountdownTimer } from "@/components/exam/countdown-timer";
import { ShortAnswerBubbleInput } from "@/components/exam/short-answer-bubble-input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import {
  fetchStudentExamAttempt,
  finalizeStudentExamAttempt,
  saveStudentExamAttemptAnswers,
  submitStudentExamAttempt,
} from "@/lib/api/student-exams";
import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import {
  EXAM_STRUCTURE,
  PART_ONE_CHOICES,
  PART_TWO_STATEMENTS,
} from "@/lib/constants/exam";
import {
  countAnsweredPartTwoStatements,
  getAttemptAnswerProgress,
} from "@/lib/exam/attempt-answers";
import {
  AUTOSAVE_STATUS,
  useAttemptAutosave,
  type AutosaveStatus,
} from "@/hooks/use-attempt-autosave";
import { cn } from "@/lib/utils";
import { attemptAnswersSchema } from "@/lib/validations/attempt-answers";
import type {
  AttemptAnswerProgress,
  AttemptAnswers,
  StudentExamAttemptContext,
} from "@/types/exam-attempt";
import type { PartOneAnswer, ShortAnswerSlots } from "@/types/exam";

const submittedAtFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

const savedAtFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});
const FINAL_AUTOSAVE_WAIT_MS = 2000;
const PDF_LOAD_TIMEOUT_MS = 15_000;

interface AttemptWorkspaceProps {
  examId: string;
  attemptId: string;
}

function getResultHref(examId: string, attemptId: string): string {
  return `/student/exams/${examId}/attempts/${attemptId}/result`;
}

interface AnswerSheetProps {
  answers: AttemptAnswers;
  setAnswers: Dispatch<SetStateAction<AttemptAnswers>>;
  disabled: boolean;
  progress: AttemptAnswerProgress;
}

function getRequestError(
  error: unknown,
  fallback = "Không thể tải lượt làm bài. Vui lòng thử lại.",
): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return fallback;
}

function isRetryableFinalizationError(error: unknown): boolean {
  return (
    !(error instanceof ApiClientError) ||
    error.statusCode === 408 ||
    error.statusCode >= 500 ||
    error.code === "EXAM_ATTEMPT_STATE_CONFLICT"
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function QuestionStatusLink({
  targetId,
  questionNumber,
  answered,
  sectionLabel,
  onSelect,
}: {
  targetId: string;
  questionNumber: number;
  answered: boolean;
  sectionLabel: string;
  onSelect: (targetId: string) => void;
}) {
  return (
    <a
      href={`#${targetId}`}
      aria-label={`${sectionLabel}, câu ${questionNumber}, ${answered ? "đã trả lời" : "chưa trả lời"}`}
      onClick={(event) => {
        event.preventDefault();
        onSelect(targetId);
      }}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-md border text-xs font-semibold outline-none focus-visible:ring-3",
        answered
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-input bg-background text-muted-foreground hover:border-primary hover:text-foreground",
      )}
    >
      {questionNumber}
    </a>
  );
}

function QuestionOverview({
  progress,
  onQuestionSelect,
}: {
  progress: AttemptAnswerProgress;
  onQuestionSelect: (targetId: string) => void;
}) {
  const sections = [
    {
      label: "Phần I",
      idPrefix: "part-one-question",
      questions: progress.partOne,
    },
    {
      label: "Phần II",
      idPrefix: "part-two-question",
      questions: progress.partTwo,
    },
    {
      label: "Phần III",
      idPrefix: "part-three-question",
      questions: progress.partThree,
    },
  ];

  return (
    <nav aria-label="Tổng quan câu trả lời" className="space-y-3">
      {sections.map((section) => (
        <div key={section.label} className="flex items-start gap-3">
          <p className="w-16 shrink-0 pt-1.5 text-xs font-semibold">
            {section.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {section.questions.map((answered, questionIndex) => (
              <QuestionStatusLink
                key={questionIndex}
                targetId={`${section.idPrefix}-${questionIndex + 1}`}
                questionNumber={questionIndex + 1}
                answered={answered}
                sectionLabel={section.label}
                onSelect={onQuestionSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function PartOneSection({
  answers,
  setAnswers,
  disabled,
  progress,
}: AnswerSheetProps) {
  function selectAnswer(questionIndex: number, choice: PartOneAnswer) {
    setAnswers((currentAnswers) => {
      const partOne = [...currentAnswers.partOne];
      partOne[questionIndex] = choice;
      return { ...currentAnswers, partOne };
    });
  }

  return (
    <section aria-labelledby="part-one-heading" className="space-y-3">
      <div>
        <p className="text-primary text-xs font-bold tracking-wider">PHẦN I</p>
        <h2 id="part-one-heading" className="mt-1 text-lg font-semibold">
          Trắc nghiệm nhiều lựa chọn
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Chọn một đáp án A, B, C hoặc D cho mỗi câu.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {answers.partOne.map((selectedAnswer, questionIndex) => (
          <fieldset
            key={questionIndex}
            id={`part-one-question-${questionIndex + 1}`}
            disabled={disabled}
            className={cn(
              "scroll-mt-40 rounded-lg border p-3",
              progress.partOne[questionIndex]
                ? "border-emerald-600/40"
                : "border-border border-dashed",
            )}
          >
            <legend className="px-1 text-sm font-semibold">
              Câu {questionIndex + 1}
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {PART_ONE_CHOICES.map((choice) => (
                <label
                  key={choice}
                  className={cn(
                    "focus-within:border-ring focus-within:ring-ring/50 flex h-9 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold transition-colors focus-within:ring-3",
                    selectedAnswer === choice
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:border-primary",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name={`part-one-${questionIndex}`}
                    value={choice}
                    checked={selectedAnswer === choice}
                    className="sr-only"
                    onChange={() => selectAnswer(questionIndex, choice)}
                  />
                  {choice}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function PartTwoSection({
  answers,
  setAnswers,
  disabled,
  progress,
}: AnswerSheetProps) {
  function selectStatementAnswer(
    questionIndex: number,
    statement: (typeof PART_TWO_STATEMENTS)[number],
    value: boolean,
  ) {
    setAnswers((currentAnswers) => {
      const partTwo = currentAnswers.partTwo.map((answer, index) =>
        index === questionIndex ? { ...answer, [statement]: value } : answer,
      );
      return { ...currentAnswers, partTwo };
    });
  }

  return (
    <section aria-labelledby="part-two-heading" className="space-y-3">
      <div>
        <p className="text-primary text-xs font-bold tracking-wider">PHẦN II</p>
        <h2 id="part-two-heading" className="mt-1 text-lg font-semibold">
          Trắc nghiệm đúng/sai
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Chọn Đúng hoặc Sai cho cả bốn ý của mỗi câu.
        </p>
      </div>

      <div className="space-y-3">
        {answers.partTwo.map((answer, questionIndex) => {
          const answeredStatements = countAnsweredPartTwoStatements(answer);

          return (
            <fieldset
              key={questionIndex}
              id={`part-two-question-${questionIndex + 1}`}
              disabled={disabled}
              className={cn(
                "scroll-mt-40 rounded-lg border p-3",
                progress.partTwo[questionIndex]
                  ? "border-emerald-600/40"
                  : "border-border border-dashed",
              )}
            >
              <legend className="px-1 text-sm font-semibold">
                Câu {questionIndex + 1}
              </legend>
              <p className="text-muted-foreground mb-2 text-xs">
                Đã trả lời {answeredStatements}/
                {EXAM_STRUCTURE.partTwoStatementsPerQuestion} ý
              </p>
              <div className="divide-border divide-y">
                {PART_TWO_STATEMENTS.map((statement) => (
                  <div
                    key={statement}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span
                      id={`part-two-${questionIndex}-${statement}-label`}
                      className="text-sm font-semibold"
                    >
                      Ý {statement}
                    </span>
                    <div
                      role="radiogroup"
                      aria-labelledby={`part-two-${questionIndex}-${statement}-label`}
                      className="grid grid-cols-2 gap-2"
                    >
                      {[
                        { label: "Đúng", value: true },
                        { label: "Sai", value: false },
                      ].map((option) => (
                        <label
                          key={option.label}
                          className={cn(
                            "focus-within:border-ring focus-within:ring-ring/50 flex h-8 min-w-16 cursor-pointer items-center justify-center rounded-md border px-2 text-xs font-medium focus-within:ring-3",
                            answer[statement] === option.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background hover:border-primary",
                            disabled && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <input
                            type="radio"
                            name={`part-two-${questionIndex}-${statement}`}
                            checked={answer[statement] === option.value}
                            className="sr-only"
                            onChange={() =>
                              selectStatementAnswer(
                                questionIndex,
                                statement,
                                option.value,
                              )
                            }
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

function PartThreeSection({ answers, setAnswers, disabled }: AnswerSheetProps) {
  function updateShortAnswer(questionIndex: number, value: ShortAnswerSlots) {
    setAnswers((currentAnswers) => {
      const partThree = [...currentAnswers.partThree];
      partThree[questionIndex] = value;
      return { ...currentAnswers, partThree };
    });
  }

  return (
    <section aria-labelledby="part-three-heading" className="space-y-3">
      <div>
        <p className="text-primary text-xs font-bold tracking-wider">
          PHẦN III
        </p>
        <h2 id="part-three-heading" className="mt-1 text-lg font-semibold">
          Trắc nghiệm trả lời ngắn
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Tô tối đa bốn ô ký tự. Dấu thập phân được hiển thị bằng dấu phẩy.
        </p>
      </div>

      <div className="space-y-3">
        {answers.partThree.map((answer, questionIndex) => (
          <div
            key={questionIndex}
            id={`part-three-question-${questionIndex + 1}`}
            className="scroll-mt-40"
          >
            <ShortAnswerBubbleInput
              value={answer}
              onChange={(value) => updateShortAnswer(questionIndex, value)}
              label={`Câu ${questionIndex + 1}`}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function AnswerSheet(props: AnswerSheetProps) {
  return (
    <div className="space-y-8 p-4 sm:p-5">
      <PartOneSection {...props} />
      <PartTwoSection {...props} />
      <PartThreeSection {...props} />
    </div>
  );
}

function EndedAttempt({ context }: { context: StudentExamAttemptContext }) {
  const wasAutoSubmitted =
    context.attempt.status === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED;

  return (
    <div className="mx-auto max-w-2xl py-12">
      <section className="border-border bg-background space-y-4 rounded-xl border p-6 text-center shadow-sm">
        <p className="text-primary text-sm font-semibold">LƯỢT LÀM BÀI</p>
        <h1 className="text-2xl font-bold">{context.exam.title}</h1>
        <p className="text-muted-foreground">
          Lần làm {context.attempt.attemptNumber}
        </p>
        <div className="bg-muted rounded-lg p-4 text-sm leading-6">
          {wasAutoSubmitted
            ? "Đã hết thời gian và bài làm đã được tự động nộp."
            : "Bài làm đã được nộp thành công."}{" "}
          Phiếu trả lời không còn có thể chỉnh sửa.
        </div>
        {context.attempt.submittedAt && (
          <p className="text-muted-foreground text-sm">
            Thời điểm nộp:{" "}
            {submittedAtFormatter.format(new Date(context.attempt.submittedAt))}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={getResultHref(context.exam.id, context.attempt.id)}>
              Xem kết quả
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/student">Quay lại danh sách đề thi</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function AutosaveIndicator({
  status,
  lastSavedAt,
}: {
  status: AutosaveStatus;
  lastSavedAt?: string;
}) {
  const labels: Record<AutosaveStatus, string> = {
    [AUTOSAVE_STATUS.SAVED]: lastSavedAt
      ? `Đã lưu lúc ${savedAtFormatter.format(new Date(lastSavedAt))}`
      : "Đã lưu",
    [AUTOSAVE_STATUS.UNSAVED]: "Chưa lưu",
    [AUTOSAVE_STATUS.SAVING]: "Đang lưu...",
    [AUTOSAVE_STATUS.ERROR]: "Lỗi khi lưu, sẽ thử lại",
  };
  const isError = status === AUTOSAVE_STATUS.ERROR;

  return (
    <p
      aria-live="polite"
      className={cn(
        "text-xs font-medium",
        isError ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {labels[status]}
    </p>
  );
}

function ActiveAttemptWorkspace({
  initialContext,
}: {
  initialContext: StudentExamAttemptContext;
}) {
  const router = useRouter();
  const { exam, attempt: initialAttempt } = initialContext;
  const [context, setContext] = useState(initialContext);
  const [answers, setAnswers] = useState<AttemptAnswers>(
    initialAttempt.answers,
  );
  const [hasCountdownExpired, setHasCountdownExpired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isAutoFinalizing, setIsAutoFinalizing] = useState(false);
  const [isExpirationPending, setIsExpirationPending] = useState(false);
  const [autoFinalizationError, setAutoFinalizationError] = useState<
    string | null
  >(null);
  const [pdfLoadState, setPdfLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [pdfLoadVersion, setPdfLoadVersion] = useState(0);
  const autoSubmitInFlightRef = useRef(false);
  const expirationStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const answerSheetRef = useRef<HTMLElement>(null);
  const answerSheetHeaderRef = useRef<HTMLDivElement>(null);
  const autoSubmitRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autosaveEnabled =
    context.attempt.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS &&
    context.canEditAnswers &&
    !hasCountdownExpired &&
    !isSubmitting;
  const answerPayloadIsValid = attemptAnswersSchema.safeParse(answers).success;
  const autosave = useAttemptAutosave({
    answers,
    initialAnswers: initialAttempt.answers,
    initialLastSavedAt: initialAttempt.lastSavedAt,
    enabled: autosaveEnabled,
    isPayloadValid: answerPayloadIsValid,
    saveAnswers: async (latestAnswers) => {
      try {
        const response = await saveStudentExamAttemptAnswers(
          exam.id,
          initialAttempt.id,
          latestAnswers,
        );
        return { lastSavedAt: response.data.attempt.lastSavedAt };
      } catch (error) {
        if (
          error instanceof ApiClientError &&
          error.code === "EXAM_ATTEMPT_LOCKED"
        ) {
          await adoptTerminalAttemptIfAvailable();
        }

        throw error;
      }
    },
  });
  const progress = getAttemptAnswerProgress(answers);

  function navigateToQuestion(targetId: string) {
    const answerSheet = answerSheetRef.current;
    const target = document.getElementById(targetId);

    if (!answerSheet || !target || !answerSheet.contains(target)) {
      return;
    }

    const answerSheetScrollsIndependently =
      window.getComputedStyle(answerSheet).overflowY === "auto";

    if (!answerSheetScrollsIndependently) {
      target.scrollIntoView({ block: "start" });
      return;
    }

    if (answerSheet.scrollHeight <= answerSheet.clientHeight) {
      return;
    }

    const targetTop =
      answerSheet.scrollTop +
      target.getBoundingClientRect().top -
      answerSheet.getBoundingClientRect().top;
    const stickyHeaderHeight = answerSheetHeaderRef.current?.offsetHeight ?? 0;

    answerSheet.scrollTo({
      top: Math.max(0, targetTop - stickyHeaderHeight - 12),
    });
  }

  async function adoptTerminalAttemptIfAvailable(): Promise<boolean> {
    try {
      const response = await fetchStudentExamAttempt(
        exam.id,
        initialAttempt.id,
      );
      const latestContext = response.data.context;

      if (
        latestContext.attempt.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS &&
        latestContext.canEditAnswers
      ) {
        return false;
      }

      if (!isMountedRef.current) {
        return true;
      }

      setAnswers(latestContext.attempt.answers);
      setContext(latestContext);
      setIsSubmitDialogOpen(false);
      router.replace(getResultHref(exam.id, initialAttempt.id));
      return true;
    } catch {
      return false;
    }
  }

  function clearAutoSubmitRetry() {
    if (autoSubmitRetryTimerRef.current) {
      clearTimeout(autoSubmitRetryTimerRef.current);
      autoSubmitRetryTimerRef.current = null;
    }
  }

  function scheduleAutoSubmitRetry(delayMilliseconds: number) {
    if (!isMountedRef.current) {
      return;
    }

    clearAutoSubmitRetry();
    autoSubmitRetryTimerRef.current = setTimeout(() => {
      autoSubmitRetryTimerRef.current = null;
      if (expirationStartedRef.current) {
        void finalizeAfterExpiration();
      } else {
        void handleCountdownExpired();
      }
    }, delayMilliseconds);
  }

  async function finalizeAfterExpiration() {
    if (!isMountedRef.current || autoSubmitInFlightRef.current) {
      return;
    }

    clearAutoSubmitRetry();
    autoSubmitInFlightRef.current = true;
    setIsAutoFinalizing(true);
    setAutoFinalizationError(null);

    try {
      const response = await finalizeStudentExamAttempt(
        exam.id,
        initialAttempt.id,
      );
      const result = response.data;

      if (!isMountedRef.current) {
        return;
      }

      if (result.attempt.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS) {
        const authoritativeRemaining = Math.max(
          0,
          new Date(result.attempt.expiresAt).getTime() -
            new Date(result.serverNow).getTime(),
        );
        setContext((currentContext) => ({
          ...currentContext,
          attempt: result.attempt,
          serverNow: result.serverNow,
          canEditAnswers: result.canEditAnswers,
        }));
        setHasCountdownExpired(false);
        setIsExpirationPending(false);
        expirationStartedRef.current = false;
        scheduleAutoSubmitRetry(Math.max(500, authoritativeRemaining + 250));
        setIsAutoFinalizing(false);
      } else {
        clearAutoSubmitRetry();
        setAnswers(result.attempt.answers);
        setContext((currentContext) => ({
          ...currentContext,
          attempt: result.attempt,
          serverNow: result.serverNow,
          canEditAnswers: result.canEditAnswers,
        }));
        setIsAutoFinalizing(false);
        router.replace(getResultHref(exam.id, initialAttempt.id));
      }
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setIsAutoFinalizing(false);
      setAutoFinalizationError(
        getRequestError(
          error,
          "Không thể hoàn tất nộp bài tự động. Vui lòng thử lại.",
        ),
      );

      if (isRetryableFinalizationError(error)) {
        scheduleAutoSubmitRetry(3000);
      }
    } finally {
      autoSubmitInFlightRef.current = false;
    }
  }

  async function handleCountdownExpired() {
    if (expirationStartedRef.current) {
      return;
    }

    expirationStartedRef.current = true;
    clearAutoSubmitRetry();
    setIsExpirationPending(true);
    setIsSubmitDialogOpen(false);
    setSubmissionError(null);
    const finalSave = autosave.flush().catch(() => undefined);
    await Promise.race([finalSave, wait(FINAL_AUTOSAVE_WAIT_MS)]);

    if (!isMountedRef.current) {
      return;
    }

    setHasCountdownExpired(true);
    setIsExpirationPending(false);
    await finalizeAfterExpiration();
  }

  async function handleManualSubmit() {
    if (
      isSubmitting ||
      hasCountdownExpired ||
      isExpirationPending ||
      !answerPayloadIsValid
    ) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await submitStudentExamAttempt(
        exam.id,
        initialAttempt.id,
        answers,
      );
      const result = response.data;

      if (!isMountedRef.current) {
        return;
      }

      setAnswers(result.attempt.answers);
      setContext((currentContext) => ({
        ...currentContext,
        attempt: result.attempt,
        serverNow: result.serverNow,
        canEditAnswers: result.canEditAnswers,
      }));
      setIsSubmitDialogOpen(false);
      router.replace(getResultHref(exam.id, initialAttempt.id));
    } catch (submitError) {
      const errorMessage = getRequestError(
        submitError,
        "Không thể nộp bài. Vui lòng thử lại.",
      );
      const isAuthenticationError =
        submitError instanceof ApiClientError &&
        (submitError.code === "UNAUTHENTICATED" ||
          submitError.code === "FORBIDDEN");
      const adoptedTerminalAttempt = isAuthenticationError
        ? false
        : await adoptTerminalAttemptIfAvailable();

      if (!isMountedRef.current || adoptedTerminalAttempt) {
        return;
      }

      setSubmissionError(errorMessage);
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearAutoSubmitRetry();
    };
  }, []);

  useEffect(() => {
    if (pdfLoadState !== "loading") {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setPdfLoadState("error"),
      PDF_LOAD_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [pdfLoadState, pdfLoadVersion]);

  if (
    context.attempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS ||
    !context.canEditAnswers
  ) {
    return <EndedAttempt context={context} />;
  }

  return (
    <>
      <AlertDialog
        open={isSubmitDialogOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) {
            setIsSubmitDialogOpen(open);
            setSubmissionError(null);
          }
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            submitButtonRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận nộp bài</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đã hoàn thành {progress.answeredQuestions}/
              {progress.totalQuestions} câu.{" "}
              {progress.answeredQuestions < progress.totalQuestions && (
                <>
                  Vẫn còn {progress.totalQuestions - progress.answeredQuestions}{" "}
                  câu chưa hoàn thành.{" "}
                </>
              )}
              Sau khi nộp, câu trả lời không thể thay đổi và lượt làm bài sẽ kết
              thúc.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {submissionError && (
            <p role="alert" className="text-destructive text-sm">
              {submissionError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Tiếp tục làm
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleManualSubmit()}
            >
              {isSubmitting ? "Đang nộp bài..." : "Xác nhận nộp bài"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex h-full min-h-0 flex-col gap-3">
        <header className="border-border bg-background sticky top-0 z-20 shrink-0 rounded-xl border px-4 py-3 shadow-sm lg:static">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide">
                LẦN LÀM {context.attempt.attemptNumber}
              </p>
              <h1
                className="truncate text-xl font-bold"
                title={context.exam.title}
              >
                {context.exam.title}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="text-muted-foreground text-xs">Đã trả lời</p>
                <p className="font-semibold tabular-nums">
                  {progress.answeredQuestions}/{progress.totalQuestions} câu
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">
                  Thời gian còn lại
                </p>
                <CountdownTimer
                  expiresAt={context.attempt.expiresAt}
                  serverNow={context.serverNow}
                  onRemainingChange={(remainingMilliseconds) => {
                    if (
                      remainingMilliseconds > 0 &&
                      remainingMilliseconds <= 3000
                    ) {
                      void autosave.flush().catch(() => undefined);
                    }
                  }}
                  onExpired={handleCountdownExpired}
                />
              </div>
              <div className="min-w-32">
                <p className="text-muted-foreground text-xs">Tự động lưu</p>
                <AutosaveIndicator
                  status={autosave.status}
                  lastSavedAt={autosave.lastSavedAt}
                />
              </div>
              <Button
                ref={submitButtonRef}
                type="button"
                disabled={
                  isSubmitting ||
                  hasCountdownExpired ||
                  isExpirationPending ||
                  !answerPayloadIsValid
                }
                title={
                  answerPayloadIsValid
                    ? undefined
                    : "Hãy hoàn thành hoặc xóa đáp án Phần III chưa hợp lệ."
                }
                onClick={() => setIsSubmitDialogOpen(true)}
              >
                Nộp bài
              </Button>
            </div>
          </div>
        </header>

        {(hasCountdownExpired || isExpirationPending) && (
          <div
            role="status"
            className="border-destructive/30 bg-destructive/5 text-destructive shrink-0 rounded-lg border px-4 py-2 text-sm"
          >
            Hết giờ.{" "}
            {isAutoFinalizing
              ? "Đang hoàn tất nộp bài..."
              : autoFinalizationError
                ? autoFinalizationError
                : "Đang đồng bộ câu trả lời cuối cùng..."}
            {autoFinalizationError && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-3"
                disabled={isAutoFinalizing}
                onClick={() => void finalizeAfterExpiration()}
              >
                Thử nộp lại
              </Button>
            )}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(24rem,2fr)]">
          <section
            aria-labelledby="exam-pdf-heading"
            className="border-border bg-background flex min-h-[65dvh] flex-col overflow-hidden rounded-xl border shadow-sm lg:min-h-0"
          >
            <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
              <div className="min-w-0">
                <h2 id="exam-pdf-heading" className="text-sm font-semibold">
                  Đề thi PDF
                </h2>
                <p className="text-muted-foreground truncate text-xs">
                  {context.exam.pdf.filename}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={context.exam.pdf.url} target="_blank" rel="noreferrer">
                  Mở tab mới
                </a>
              </Button>
            </div>
            {pdfLoadState === "loading" && (
              <p
                role="status"
                className="text-muted-foreground px-4 py-3 text-center text-sm"
              >
                Đang tải đề thi PDF...
              </p>
            )}
            {pdfLoadState === "error" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <p role="alert" className="text-destructive text-sm">
                  Không thể hiển thị đề thi PDF trong trang này.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPdfLoadState("loading");
                      setPdfLoadVersion((version) => version + 1);
                    }}
                  >
                    Thử tải lại
                  </Button>
                  <Button asChild variant="outline">
                    <a
                      href={context.exam.pdf.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở đề thi PDF
                    </a>
                  </Button>
                </div>
              </div>
            )}
            <object
              key={pdfLoadVersion}
              data={context.exam.pdf.url}
              type="application/pdf"
              title={`Đề thi ${context.exam.title}`}
              className={cn(
                "min-h-0 w-full flex-1",
                pdfLoadState === "error" && "hidden",
              )}
              onLoad={() => setPdfLoadState("ready")}
              onError={() => setPdfLoadState("error")}
            >
              <div className="flex h-full min-h-96 flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-muted-foreground text-sm">
                  Trình duyệt không thể hiển thị tệp PDF trực tiếp.
                </p>
                <Button asChild variant="outline">
                  <a
                    href={context.exam.pdf.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mở đề thi PDF
                  </a>
                </Button>
              </div>
            </object>
          </section>

          <section
            ref={answerSheetRef}
            aria-labelledby="answer-sheet-heading"
            className="border-border bg-background min-h-0 rounded-xl border shadow-sm lg:h-full lg:overflow-y-auto lg:overscroll-contain"
          >
            <div
              ref={answerSheetHeaderRef}
              className="border-border bg-background/95 z-10 space-y-3 border-b p-4 backdrop-blur-sm lg:sticky lg:top-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="answer-sheet-heading" className="font-semibold">
                    Phiếu trả lời
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    Màu xanh biểu thị câu đã hoàn thành.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                  {progress.answeredQuestions}/{progress.totalQuestions}
                </span>
              </div>
              <QuestionOverview
                progress={progress}
                onQuestionSelect={navigateToQuestion}
              />
              {!answerPayloadIsValid && (
                <p role="alert" className="text-destructive text-xs leading-5">
                  Có đáp án Phần III chưa hợp lệ. Hãy hoàn thành giá trị hoặc
                  xóa các ô đã chọn để tiếp tục lưu.
                </p>
              )}
              <p className="text-muted-foreground text-xs leading-5">
                Câu trả lời được tự động lưu khi bạn ngừng thao tác trong giây
                lát.
              </p>
            </div>

            <AnswerSheet
              answers={answers}
              setAnswers={setAnswers}
              disabled={
                hasCountdownExpired || isExpirationPending || isSubmitting
              }
              progress={progress}
            />
          </section>
        </div>
      </div>
    </>
  );
}

export function AttemptWorkspace({ examId, attemptId }: AttemptWorkspaceProps) {
  const [context, setContext] = useState<StudentExamAttemptContext | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    void fetchStudentExamAttempt(examId, attemptId)
      .then((response) => {
        if (isCurrent) {
          setContext(response.data.context);
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
      <div className="mx-auto max-w-2xl py-12">
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
              Thử tải lại
            </Button>
            <Button asChild variant="outline">
              <Link href="/student">Quay lại danh sách đề thi</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <p className="text-muted-foreground py-12 text-center" aria-live="polite">
        Đang tải không gian làm bài...
      </p>
    );
  }

  if (!context.canEditAnswers) {
    return <EndedAttempt context={context} />;
  }

  return <ActiveAttemptWorkspace initialContext={context} />;
}
