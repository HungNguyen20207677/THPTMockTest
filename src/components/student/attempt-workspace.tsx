"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { CountdownTimer } from "@/components/exam/countdown-timer";
import { ShortAnswerBubbleInput } from "@/components/exam/short-answer-bubble-input";
import { ShortAnswerTextInput } from "@/components/exam/short-answer-text-input";
import { EssayImageAnswerInput } from "@/components/student/essay-image-answer-input";
import { ExamWorkspaceSkeleton } from "@/components/shared/loading-skeletons";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError } from "@/lib/api/client";
import {
  fetchStudentExamAttempt,
  finalizeStudentExamAttempt,
  removeStudentEssayImage,
  saveStudentExamAttemptAnswers,
  setStudentExamAttemptQuestionFlag,
  submitStudentExamAttempt,
  uploadStudentEssayImage,
} from "@/lib/api/student-exams";
import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import {
  EXAM_STRUCTURE,
  PART3_INPUT_MODE,
  PART_ONE_CHOICES,
  PART_TWO_STATEMENTS,
} from "@/lib/constants/exam";
import {
  countAnsweredPartTwoStatements,
  getDynamicAttemptAnswerProgress,
  getAttemptAnswerProgress,
  mergePersistedEssayImageAnswer,
} from "@/lib/exam/attempt-answers";
import {
  advanceExamFullscreenTracking,
  createExamFullscreenTrackingState,
} from "@/lib/exam/fullscreen-exit";
import {
  exitDocumentFullscreen,
  isDocumentElementFullscreen,
  isFullscreenSupported,
  requestDocumentFullscreen,
} from "@/lib/fullscreen";
import {
  AUTOSAVE_STATUS,
  useAttemptAutosave,
  type AutosaveStatus,
} from "@/hooks/use-attempt-autosave";
import { cn } from "@/lib/utils";
import {
  createAttemptAnswersSchemaForStructure,
  isDynamicAttemptAnswers,
} from "@/lib/validations/attempt-answers";
import type {
  AttemptAnswerProgress,
  AttemptAnswers,
  AttemptPartTwoAnswer,
  DynamicAttemptAnswer,
  DynamicAttemptAnswerProgress,
  DynamicAttemptAnswers,
  ExamAttemptAnswers,
  EssayImageAnswer,
  StudentExamAttemptContext,
} from "@/types/exam-attempt";
import type {
  Part3InputMode,
  PartOneAnswer,
  ShortAnswerSlots,
} from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";

const submittedAtFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

const FINAL_AUTOSAVE_WAIT_MS = 2000;
const PDF_LOAD_TIMEOUT_MS = 15_000;

type ExamEnvironmentWarning =
  "FULLSCREEN_SUBMIT" | "PAGE_HIDDEN" | "FILE_PICKER_FULLSCREEN";

interface AttemptWorkspaceProps {
  examId: string;
  attemptId: string;
}

function getResultHref(examId: string, attemptId: string): string {
  return `/student/exams/${examId}/attempts/${attemptId}/result`;
}

interface AnswerSheetProps {
  answers: AttemptAnswers;
  updateAnswers: (updater: (answers: AttemptAnswers) => AttemptAnswers) => void;
  disabled: boolean;
  progress: AttemptAnswerProgress;
  part3InputMode: Part3InputMode;
  onPartThreeTextValidityChange: (
    questionIndex: number,
    isValid: boolean,
  ) => void;
  flaggedQuestionIds: ReadonlySet<string>;
  pendingFlagQuestionIds: ReadonlySet<string>;
  onToggleQuestionFlag: (questionId: string) => void;
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

function FlagIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3H18l-2.5 4L18 11H7" />
    </svg>
  );
}

function QuestionFlagButton({
  questionId,
  label,
  flagged,
  pending,
  disabled,
  onToggle,
}: {
  questionId: string;
  label: string;
  flagged: boolean;
  pending: boolean;
  disabled: boolean;
  onToggle: (questionId: string) => void;
}) {
  const actionLabel = flagged
    ? `Bỏ đánh dấu ${label}`
    : `Đánh dấu ${label} để xem lại`;

  return (
    <button
      type="button"
      aria-label={actionLabel}
      aria-pressed={flagged}
      aria-busy={pending}
      title={actionLabel}
      disabled={disabled}
      className={cn(
        "focus-visible:ring-ring/50 group relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg border outline-none transition-[color,background-color,border-color,transform] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50",
        flagged
          ? "border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
          : "border-input bg-background text-muted-foreground hover:border-amber-500 hover:text-amber-700",
        pending && "motion-safe:animate-pulse",
      )}
      onClick={() => onToggle(questionId)}
    >
      <FlagIcon filled={flagged} />
      <span
        role="tooltip"
        className="bg-popover text-popover-foreground pointer-events-none absolute right-0 bottom-full z-20 mb-1.5 w-max max-w-56 rounded-md border px-2 py-1 text-xs font-normal opacity-0 shadow-md transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {actionLabel}
      </span>
    </button>
  );
}

function QuestionStatusLink({
  targetId,
  questionId,
  questionNumber,
  answered,
  flagged,
  current,
  sectionLabel,
  onSelect,
}: {
  targetId: string;
  questionId: string;
  questionNumber: number;
  answered: boolean;
  flagged: boolean;
  current: boolean;
  sectionLabel: string;
  onSelect: (targetId: string, questionId: string) => void;
}) {
  return (
    <a
      href={`#${targetId}`}
      aria-label={`${sectionLabel}, câu ${questionNumber}, ${answered ? "đã trả lời" : "chưa trả lời"}${flagged ? ", đã đánh dấu" : ""}`}
      aria-current={current ? "true" : undefined}
      onClick={(event) => {
        event.preventDefault();
        onSelect(targetId, questionId);
      }}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 relative flex size-9 items-center justify-center rounded-lg border text-xs font-semibold outline-none transition-colors motion-reduce:transition-none focus-visible:ring-3",
        answered
          ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
          : "border-input bg-background text-muted-foreground border-dashed hover:border-primary hover:text-foreground",
        flagged && "ring-2 ring-amber-400 ring-offset-1",
        current && "outline-primary outline-2 outline-offset-2",
      )}
    >
      {questionNumber}
      {flagged && (
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-100 p-0.5 text-amber-800 shadow-sm dark:bg-amber-950 dark:text-amber-200">
          <FlagIcon filled />
        </span>
      )}
    </a>
  );
}

function QuestionOverview({
  progress,
  flaggedQuestionIds,
  currentQuestionId,
  onQuestionSelect,
}: {
  progress: AttemptAnswerProgress;
  flaggedQuestionIds: ReadonlySet<string>;
  currentQuestionId: string | null;
  onQuestionSelect: (targetId: string, questionId: string) => void;
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
    <nav aria-label="Tổng quan câu trả lời" className="space-y-2.5">
      {sections.map((section) => (
        <div key={section.label} className="flex items-start gap-2.5">
          <p className="w-14 shrink-0 pt-2.5 text-xs font-semibold">
            {section.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {section.questions.map((answered, questionIndex) => {
              const questionId = `${section.idPrefix}-${questionIndex + 1}`;
              return (
                <QuestionStatusLink
                  key={questionId}
                  targetId={questionId}
                  questionId={questionId}
                  questionNumber={questionIndex + 1}
                  answered={answered}
                  flagged={flaggedQuestionIds.has(questionId)}
                  current={currentQuestionId === questionId}
                  sectionLabel={section.label}
                  onSelect={onQuestionSelect}
                />
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function getDynamicQuestionTargetId(
  sectionIndex: number,
  questionIndex: number,
): string {
  return `dynamic-question-${sectionIndex + 1}-${questionIndex + 1}`;
}

function DynamicQuestionOverview({
  structure,
  progress,
  flaggedQuestionIds,
  currentQuestionId,
  onQuestionSelect,
}: {
  structure: ExamStructureSnapshot;
  progress: DynamicAttemptAnswerProgress;
  flaggedQuestionIds: ReadonlySet<string>;
  currentQuestionId: string | null;
  onQuestionSelect: (targetId: string, questionId: string) => void;
}) {
  return (
    <nav aria-label="Tổng quan câu trả lời" className="space-y-2.5">
      {structure.sections.map((section, sectionIndex) => (
        <div key={section.id} className="flex items-start gap-2.5">
          <p className="w-20 shrink-0 pt-2.5 text-xs font-semibold leading-4">
            {section.title}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {section.questions.map((question, questionIndex) => (
              <QuestionStatusLink
                key={question.id}
                targetId={getDynamicQuestionTargetId(
                  sectionIndex,
                  questionIndex,
                )}
                questionId={question.id}
                questionNumber={questionIndex + 1}
                answered={progress.byQuestionId[question.id] ?? false}
                flagged={flaggedQuestionIds.has(question.id)}
                current={currentQuestionId === question.id}
                sectionLabel={section.title}
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
  updateAnswers,
  disabled,
  progress,
  flaggedQuestionIds,
  pendingFlagQuestionIds,
  onToggleQuestionFlag,
}: AnswerSheetProps) {
  function selectAnswer(questionIndex: number, choice: PartOneAnswer) {
    updateAnswers((currentAnswers) => {
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
        {answers.partOne.map((selectedAnswer, questionIndex) => {
          const questionId = `part-one-question-${questionIndex + 1}`;
          return (
            <fieldset
              key={questionId}
              id={questionId}
              disabled={disabled}
              className={cn(
                "scroll-mt-40 rounded-xl border bg-card p-3.5 shadow-xs",
                progress.partOne[questionIndex]
                  ? "border-emerald-600/40"
                  : "border-border border-dashed",
                flaggedQuestionIds.has(questionId) &&
                  "ring-2 ring-amber-400/70",
              )}
            >
              <legend className="w-full px-1 text-sm font-semibold">
                <span className="flex items-center justify-between gap-3">
                  Câu {questionIndex + 1}
                  <QuestionFlagButton
                    questionId={questionId}
                    label={`câu ${questionIndex + 1} Phần I`}
                    flagged={flaggedQuestionIds.has(questionId)}
                    pending={pendingFlagQuestionIds.has(questionId)}
                    disabled={disabled}
                    onToggle={onToggleQuestionFlag}
                  />
                </span>
              </legend>
              <div className="grid grid-cols-4 gap-2">
                {PART_ONE_CHOICES.map((choice) => (
                  <label
                    key={choice}
                    className={cn(
                      "focus-within:border-ring focus-within:ring-ring/50 relative flex h-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-within:ring-3",
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
          );
        })}
      </div>
    </section>
  );
}

function PartTwoSection({
  answers,
  updateAnswers,
  disabled,
  progress,
  flaggedQuestionIds,
  pendingFlagQuestionIds,
  onToggleQuestionFlag,
}: AnswerSheetProps) {
  function selectStatementAnswer(
    questionIndex: number,
    statement: (typeof PART_TWO_STATEMENTS)[number],
    value: boolean,
  ) {
    updateAnswers((currentAnswers) => {
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
          const questionId = `part-two-question-${questionIndex + 1}`;

          return (
            <fieldset
              key={questionId}
              id={questionId}
              disabled={disabled}
              className={cn(
                "scroll-mt-40 rounded-xl border bg-card p-3.5 shadow-xs",
                progress.partTwo[questionIndex]
                  ? "border-emerald-600/40"
                  : "border-border border-dashed",
                flaggedQuestionIds.has(questionId) &&
                  "ring-2 ring-amber-400/70",
              )}
            >
              <legend className="w-full px-1 text-sm font-semibold">
                <span className="flex items-center justify-between gap-3">
                  Câu {questionIndex + 1}
                  <QuestionFlagButton
                    questionId={questionId}
                    label={`câu ${questionIndex + 1} Phần II`}
                    flagged={flaggedQuestionIds.has(questionId)}
                    pending={pendingFlagQuestionIds.has(questionId)}
                    disabled={disabled}
                    onToggle={onToggleQuestionFlag}
                  />
                </span>
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
                            "focus-within:border-ring focus-within:ring-ring/50 relative flex h-9 min-w-16 cursor-pointer items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors focus-within:ring-3",
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

function PartThreeSection({
  answers,
  updateAnswers,
  disabled,
  part3InputMode,
  onPartThreeTextValidityChange,
  flaggedQuestionIds,
  pendingFlagQuestionIds,
  onToggleQuestionFlag,
}: AnswerSheetProps) {
  function updateShortAnswer(questionIndex: number, value: ShortAnswerSlots) {
    updateAnswers((currentAnswers) => {
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
          {part3InputMode === PART3_INPUT_MODE.BUBBLE
            ? "Tô tối đa bốn ô ký tự. Dấu thập phân được hiển thị bằng dấu phẩy."
            : "Nhập tối đa bốn ký tự bằng chữ số, dấu âm và dấu phẩy thập phân."}
        </p>
      </div>

      <div className="space-y-3">
        {answers.partThree.map((answer, questionIndex) => {
          const questionId = `part-three-question-${questionIndex + 1}`;
          return (
            <div
              key={questionId}
              id={questionId}
              className={cn(
                "scroll-mt-40 rounded-xl",
                flaggedQuestionIds.has(questionId) &&
                  "ring-2 ring-amber-400/70",
              )}
            >
              <div className="flex justify-end px-2 pt-2">
                <QuestionFlagButton
                  questionId={questionId}
                  label={`câu ${questionIndex + 1} Phần III`}
                  flagged={flaggedQuestionIds.has(questionId)}
                  pending={pendingFlagQuestionIds.has(questionId)}
                  disabled={disabled}
                  onToggle={onToggleQuestionFlag}
                />
              </div>
              {part3InputMode === PART3_INPUT_MODE.BUBBLE ? (
                <ShortAnswerBubbleInput
                  value={answer}
                  onChange={(value) => updateShortAnswer(questionIndex, value)}
                  label={`Câu ${questionIndex + 1}`}
                  disabled={disabled}
                />
              ) : (
                <ShortAnswerTextInput
                  value={answer}
                  onChange={(value) => updateShortAnswer(questionIndex, value)}
                  label={`Câu ${questionIndex + 1}`}
                  disabled={disabled}
                  onValidityChange={(isValid) =>
                    onPartThreeTextValidityChange(questionIndex, isValid)
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AnswerSheet(props: AnswerSheetProps) {
  return (
    <div className="space-y-8 p-3 sm:p-4">
      <PartOneSection {...props} />
      <PartTwoSection {...props} />
      <PartThreeSection {...props} />
    </div>
  );
}

interface DynamicAnswerSheetProps {
  structure: ExamStructureSnapshot;
  answers: DynamicAttemptAnswers;
  updateAnswer: (questionId: string, answer: DynamicAttemptAnswer) => void;
  disabled: boolean;
  progress: DynamicAttemptAnswerProgress;
  shortAnswerInputMode: Part3InputMode;
  onShortAnswerTextValidityChange: (
    questionId: string,
    isValid: boolean,
  ) => void;
  onEssayImageUpload: (questionId: string, file: File) => Promise<void>;
  onEssayImageRemove: (questionId: string, publicId: string) => Promise<void>;
  onFilePickerOpen: () => void;
  onFilePickerReturn: () => void;
  flaggedQuestionIds: ReadonlySet<string>;
  pendingFlagQuestionIds: ReadonlySet<string>;
  onToggleQuestionFlag: (questionId: string) => void;
}

const dynamicQuestionTypeLabels = {
  SINGLE_CHOICE: "Trắc nghiệm nhiều lựa chọn",
  TRUE_FALSE: "Trắc nghiệm đúng/sai",
  SHORT_ANSWER: "Trắc nghiệm trả lời ngắn",
  ESSAY_IMAGE: "Tự luận bằng hình ảnh",
} as const;

export function DynamicAnswerSheet({
  structure,
  answers,
  updateAnswer,
  disabled,
  progress,
  shortAnswerInputMode,
  onShortAnswerTextValidityChange,
  onEssayImageUpload,
  onEssayImageRemove,
  onFilePickerOpen,
  onFilePickerReturn,
  flaggedQuestionIds,
  pendingFlagQuestionIds,
  onToggleQuestionFlag,
}: DynamicAnswerSheetProps) {
  return (
    <div className="space-y-8 p-3 sm:p-4">
      {structure.sections.map((section, sectionIndex) => (
        <section
          key={section.id}
          aria-labelledby={`dynamic-section-${sectionIndex + 1}-heading`}
          className="space-y-3"
        >
          <div>
            <p className="text-primary text-xs font-bold tracking-wider">
              PHẦN {sectionIndex + 1}
            </p>
            <h2
              id={`dynamic-section-${sectionIndex + 1}-heading`}
              className="mt-1 text-lg font-semibold"
            >
              {section.title}
            </h2>
          </div>

          <div className="space-y-3">
            {section.questions.map((question, questionIndex) => {
              const answer = answers.answersByQuestionId[question.id];
              const targetId = getDynamicQuestionTargetId(
                sectionIndex,
                questionIndex,
              );
              const label = `Câu ${questionIndex + 1}`;
              const answered = progress.byQuestionId[question.id] ?? false;
              const scoreLabel = `${(
                question.maxScoreHundredths / 100
              ).toLocaleString("vi-VN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} điểm`;

              if (
                question.type === EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE
              ) {
                const selectedAnswer = answer as PartOneAnswer | null;
                return (
                  <fieldset
                    key={question.id}
                    id={targetId}
                    disabled={disabled}
                    className={cn(
                      "scroll-mt-40 rounded-xl border bg-card p-3.5 shadow-xs",
                      answered
                        ? "border-emerald-600/40"
                        : "border-border border-dashed",
                      flaggedQuestionIds.has(question.id) &&
                        "ring-2 ring-amber-400/70",
                    )}
                  >
                    <legend className="w-full px-1 text-sm font-semibold">
                      <span className="flex items-center justify-between gap-3">
                        {label}
                        <QuestionFlagButton
                          questionId={question.id}
                          label={`${label} ${section.title}`}
                          flagged={flaggedQuestionIds.has(question.id)}
                          pending={pendingFlagQuestionIds.has(question.id)}
                          disabled={disabled}
                          onToggle={onToggleQuestionFlag}
                        />
                      </span>
                    </legend>
                    <p className="text-muted-foreground mb-2 text-xs">
                      {dynamicQuestionTypeLabels[question.type]}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {PART_ONE_CHOICES.map((choice) => (
                        <label
                          key={choice}
                          className={cn(
                            "focus-within:border-ring focus-within:ring-ring/50 relative flex h-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-within:ring-3",
                            selectedAnswer === choice
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background hover:border-primary",
                            disabled && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <input
                            type="radio"
                            name={`dynamic-single-${sectionIndex}-${questionIndex}`}
                            value={choice}
                            checked={selectedAnswer === choice}
                            className="sr-only"
                            onChange={() => updateAnswer(question.id, choice)}
                          />
                          {choice}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              }

              if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE) {
                const statementAnswer = answer as AttemptPartTwoAnswer;
                const answeredStatements =
                  countAnsweredPartTwoStatements(statementAnswer);
                return (
                  <fieldset
                    key={question.id}
                    id={targetId}
                    disabled={disabled}
                    className={cn(
                      "scroll-mt-40 rounded-xl border bg-card p-3.5 shadow-xs",
                      answered
                        ? "border-emerald-600/40"
                        : "border-border border-dashed",
                      flaggedQuestionIds.has(question.id) &&
                        "ring-2 ring-amber-400/70",
                    )}
                  >
                    <legend className="w-full px-1 text-sm font-semibold">
                      <span className="flex items-center justify-between gap-3">
                        {label}
                        <QuestionFlagButton
                          questionId={question.id}
                          label={`${label} ${section.title}`}
                          flagged={flaggedQuestionIds.has(question.id)}
                          pending={pendingFlagQuestionIds.has(question.id)}
                          disabled={disabled}
                          onToggle={onToggleQuestionFlag}
                        />
                      </span>
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
                          <span className="text-sm font-semibold">
                            Ý {statement}
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: "Đúng", value: true },
                              { label: "Sai", value: false },
                            ].map((option) => (
                              <label
                                key={option.label}
                                className={cn(
                                  "focus-within:border-ring focus-within:ring-ring/50 relative flex h-9 min-w-16 cursor-pointer items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors focus-within:ring-3",
                                  statementAnswer[statement] === option.value
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input bg-background hover:border-primary",
                                  disabled && "cursor-not-allowed opacity-60",
                                )}
                              >
                                <input
                                  type="radio"
                                  name={`dynamic-true-false-${sectionIndex}-${questionIndex}-${statement}`}
                                  checked={
                                    statementAnswer[statement] === option.value
                                  }
                                  className="sr-only"
                                  onChange={() =>
                                    updateAnswer(question.id, {
                                      ...statementAnswer,
                                      [statement]: option.value,
                                    })
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
              }

              if (question.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER) {
                const shortAnswer = answer as ShortAnswerSlots;
                return (
                  <div
                    key={question.id}
                    id={targetId}
                    className={cn(
                      "scroll-mt-40 rounded-xl",
                      flaggedQuestionIds.has(question.id) &&
                        "ring-2 ring-amber-400/70",
                    )}
                  >
                    <div className="flex justify-end px-2 pt-2">
                      <QuestionFlagButton
                        questionId={question.id}
                        label={`${label} ${section.title}`}
                        flagged={flaggedQuestionIds.has(question.id)}
                        pending={pendingFlagQuestionIds.has(question.id)}
                        disabled={disabled}
                        onToggle={onToggleQuestionFlag}
                      />
                    </div>
                    {shortAnswerInputMode === PART3_INPUT_MODE.BUBBLE ? (
                      <ShortAnswerBubbleInput
                        value={shortAnswer}
                        onChange={(value) => updateAnswer(question.id, value)}
                        label={label}
                        disabled={disabled}
                      />
                    ) : (
                      <ShortAnswerTextInput
                        value={shortAnswer}
                        onChange={(value) => updateAnswer(question.id, value)}
                        label={label}
                        disabled={disabled}
                        onValidityChange={(isValid) =>
                          onShortAnswerTextValidityChange(question.id, isValid)
                        }
                      />
                    )}
                  </div>
                );
              }

              const essayAnswer = answer as EssayImageAnswer;
              return (
                <div
                  key={question.id}
                  id={targetId}
                  className={cn(
                    "scroll-mt-40 space-y-3 rounded-xl border bg-card p-3.5 shadow-xs",
                    answered
                      ? "border-emerald-600/40"
                      : "border-border border-dashed",
                    flaggedQuestionIds.has(question.id) &&
                      "ring-2 ring-amber-400/70",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{label}</h3>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {dynamicQuestionTypeLabels[question.type]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {scoreLabel}
                      </span>
                      <QuestionFlagButton
                        questionId={question.id}
                        label={`${label} ${section.title}`}
                        flagged={flaggedQuestionIds.has(question.id)}
                        pending={pendingFlagQuestionIds.has(question.id)}
                        disabled={disabled}
                        onToggle={onToggleQuestionFlag}
                      />
                    </div>
                  </div>
                  <EssayImageAnswerInput
                    answer={essayAnswer}
                    disabled={disabled}
                    onFilePickerOpen={onFilePickerOpen}
                    onFilePickerReturn={onFilePickerReturn}
                    onUpload={(file) => onEssayImageUpload(question.id, file)}
                    onRemove={(publicId) =>
                      onEssayImageRemove(question.id, publicId)
                    }
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
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

function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
  const labels: Record<AutosaveStatus, string> = {
    [AUTOSAVE_STATUS.SAVED]: "Đã lưu",
    [AUTOSAVE_STATUS.UNSAVED]: "Chưa lưu",
    [AUTOSAVE_STATUS.SAVING]: "Đang lưu...",
    [AUTOSAVE_STATUS.ERROR]: "Lỗi khi lưu",
  };
  const isError = status === AUTOSAVE_STATUS.ERROR;
  const statusDotClassNames: Record<AutosaveStatus, string> = {
    [AUTOSAVE_STATUS.SAVED]: "bg-emerald-500",
    [AUTOSAVE_STATUS.UNSAVED]: "bg-amber-500",
    [AUTOSAVE_STATUS.SAVING]: "bg-primary animate-pulse",
    [AUTOSAVE_STATUS.ERROR]: "bg-destructive",
  };
  return (
    <p
      aria-live="polite"
      title={`Tự động lưu: ${labels[status]}`}
      className={cn(
        "flex items-center gap-1.5 whitespace-nowrap text-xs font-medium",
        isError ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", statusDotClassNames[status])}
      />
      <span>{labels[status]}</span>
    </p>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {active ? (
        <>
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        </>
      ) : (
        <>
          <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
        </>
      )}
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="text-muted-foreground size-4 motion-safe:animate-[pulse_3s_ease-in-out_infinite] motion-reduce:animate-none"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
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
  const [answers, setAnswers] = useState<ExamAttemptAnswers>(
    initialAttempt.answers,
  );
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Set<string>>(
    () => new Set(initialAttempt.flaggedQuestionIds ?? []),
  );
  const [pendingFlagQuestionIds, setPendingFlagQuestionIds] = useState<
    Set<string>
  >(() => new Set());
  const [flagError, setFlagError] = useState<string | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(
    null,
  );
  const [hasCountdownExpired, setHasCountdownExpired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isAutoFinalizing, setIsAutoFinalizing] = useState(false);
  const [isExpirationPending, setIsExpirationPending] = useState(false);
  const [activeEssayImageMutations, setActiveEssayImageMutations] = useState(0);
  const [autoFinalizationError, setAutoFinalizationError] = useState<
    string | null
  >(null);
  const [pdfLoadState, setPdfLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [pdfLoadVersion, setPdfLoadVersion] = useState(0);
  const [shortAnswerTextValidity, setShortAnswerTextValidity] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      exam.structureSnapshot
        ? exam.structureSnapshot.sections.flatMap((section) =>
            section.questions
              .filter(
                (question) =>
                  question.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
              )
              .map((question) => [question.id, true] as const),
          )
        : Array.from(
            { length: EXAM_STRUCTURE.partThreeQuestions },
            (_, index) => [`legacy-${index}`, true] as const,
          ),
    ),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(true);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [environmentWarning, setEnvironmentWarning] =
    useState<ExamEnvironmentWarning | null>(null);
  const [fullscreenSubmissionError, setFullscreenSubmissionError] = useState<
    string | null
  >(null);
  const [isFullscreenExitDialogOpen, setIsFullscreenExitDialogOpen] =
    useState(false);
  const [isChangingFullscreenForExit, setIsChangingFullscreenForExit] =
    useState(false);
  const autoSubmitInFlightRef = useRef(false);
  const finalSubmissionInFlightRef = useRef(false);
  const expirationStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const fullscreenExitCancelButtonRef = useRef<HTMLButtonElement>(null);
  const environmentDialogDescriptionRef = useRef<HTMLParagraphElement>(null);
  const answerSheetRef = useRef<HTMLElement>(null);
  const answerSheetHeaderRef = useRef<HTMLDivElement>(null);
  const fullscreenTrackingRef = useRef(createExamFullscreenTrackingState());
  const fullscreenExitAnswersRef = useRef<ExamAttemptAnswers | null>(null);
  const answerRevisionRef = useRef(initialAttempt.answerRevision);
  const desiredFlagQuestionIdsRef = useRef(
    new Set(initialAttempt.flaggedQuestionIds ?? []),
  );
  const persistedFlagQuestionIdsRef = useRef(
    new Set(initialAttempt.flaggedQuestionIds ?? []),
  );
  const flagMutationInFlightRef = useRef(new Set<string>());
  const leftExamScreenRef = useRef(false);
  const intentionalFilePickerRef = useRef({
    active: false,
    wasFullscreen: false,
  });
  const autoSubmitRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autosaveEnabled =
    context.attempt.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS &&
    context.canEditAnswers &&
    !hasCountdownExpired;
  const answerPayloadIsValid = createAttemptAnswersSchemaForStructure(
    exam.structureSnapshot,
  ).safeParse(answers).success;
  const hasInvalidPartThreeText =
    (exam.shortAnswerInputMode ?? exam.part3InputMode) ===
      PART3_INPUT_MODE.TEXT &&
    Object.values(shortAnswerTextValidity).some((isValid) => !isValid);
  const canSubmitAnswers =
    answerPayloadIsValid &&
    !hasInvalidPartThreeText &&
    activeEssayImageMutations === 0;
  const autosave = useAttemptAutosave({
    answers,
    initialAnswers: initialAttempt.answers,
    initialLastSavedAt: initialAttempt.lastSavedAt,
    enabled: autosaveEnabled,
    isPayloadValid: answerPayloadIsValid,
    hasLocalDraft: hasInvalidPartThreeText,
    saveAnswers: async (latestAnswers) => {
      try {
        const response = await saveStudentExamAttemptAnswers(
          exam.id,
          initialAttempt.id,
          latestAnswers,
          answerRevisionRef.current,
          exam.structureSnapshot,
        );
        const result = response.data;
        answerRevisionRef.current = Math.max(
          answerRevisionRef.current,
          result.attempt.answerRevision,
        );
        setContext((currentContext) => ({
          ...currentContext,
          serverNow: result.serverNow,
          canEditAnswers: result.canEditAnswers,
          attempt: {
            ...currentContext.attempt,
            status: result.attempt.status,
            answerRevision: answerRevisionRef.current,
            submittedAt: result.attempt.submittedAt,
            lastSavedAt: result.attempt.lastSavedAt,
          },
        }));
        return { lastSavedAt: result.attempt.lastSavedAt };
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
  const dynamicAnswers =
    exam.structureSnapshot && isDynamicAttemptAnswers(answers) ? answers : null;
  const legacyAnswers =
    !exam.structureSnapshot && !isDynamicAttemptAnswers(answers)
      ? answers
      : null;
  const dynamicProgress =
    dynamicAnswers && exam.structureSnapshot
      ? getDynamicAttemptAnswerProgress(dynamicAnswers, exam.structureSnapshot)
      : null;
  const legacyProgress = legacyAnswers
    ? getAttemptAnswerProgress(legacyAnswers)
    : null;
  const progress = dynamicProgress ??
    legacyProgress ?? {
      answeredQuestions: 0,
      totalQuestions: 0,
    };

  async function persistQuestionFlag(questionId: string): Promise<void> {
    if (flagMutationInFlightRef.current.has(questionId)) {
      return;
    }

    flagMutationInFlightRef.current.add(questionId);
    setPendingFlagQuestionIds((currentIds) =>
      new Set(currentIds).add(questionId),
    );

    try {
      while (isMountedRef.current) {
        const desiredFlagged =
          desiredFlagQuestionIdsRef.current.has(questionId);
        const persistedFlagged =
          persistedFlagQuestionIdsRef.current.has(questionId);

        if (desiredFlagged === persistedFlagged) {
          setFlagError(null);
          break;
        }

        await setStudentExamAttemptQuestionFlag(
          exam.id,
          initialAttempt.id,
          questionId,
          desiredFlagged,
        );

        if (!isMountedRef.current) {
          return;
        }

        if (desiredFlagged) {
          persistedFlagQuestionIdsRef.current.add(questionId);
        } else {
          persistedFlagQuestionIdsRef.current.delete(questionId);
        }

        setContext((currentContext) => ({
          ...currentContext,
          attempt: {
            ...currentContext.attempt,
            flaggedQuestionIds: Array.from(persistedFlagQuestionIdsRef.current),
          },
        }));
        setFlagError(null);
      }
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setFlagError(
        getRequestError(
          error,
          "Không thể lưu câu đã đánh dấu. Vui lòng thử lại.",
        ),
      );

      if (
        error instanceof ApiClientError &&
        error.code === "EXAM_ATTEMPT_LOCKED"
      ) {
        await adoptTerminalAttemptIfAvailable();
      }
    } finally {
      flagMutationInFlightRef.current.delete(questionId);
      if (isMountedRef.current) {
        setPendingFlagQuestionIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(questionId);
          return nextIds;
        });
      }
    }
  }

  function toggleQuestionFlag(questionId: string) {
    const nextIds = new Set(desiredFlagQuestionIdsRef.current);

    if (nextIds.has(questionId)) {
      nextIds.delete(questionId);
    } else {
      nextIds.add(questionId);
    }

    desiredFlagQuestionIdsRef.current = nextIds;
    setFlaggedQuestionIds(nextIds);
    setFlagError(null);
    void persistQuestionFlag(questionId);
  }

  function retryQuestionFlags() {
    setFlagError(null);
    for (const questionId of new Set([
      ...desiredFlagQuestionIdsRef.current,
      ...persistedFlagQuestionIdsRef.current,
    ])) {
      if (
        desiredFlagQuestionIdsRef.current.has(questionId) !==
        persistedFlagQuestionIdsRef.current.has(questionId)
      ) {
        void persistQuestionFlag(questionId);
      }
    }
  }

  function setPartThreeTextAnswerValidity(
    questionIndex: number,
    isValid: boolean,
  ) {
    const questionId = `legacy-${questionIndex}`;
    setShortAnswerTextValidity((currentValidity) => {
      if (currentValidity[questionId] === isValid) {
        return currentValidity;
      }

      return { ...currentValidity, [questionId]: isValid };
    });
  }

  function setDynamicShortAnswerTextValidity(
    questionId: string,
    isValid: boolean,
  ) {
    setShortAnswerTextValidity((currentValidity) =>
      currentValidity[questionId] === isValid
        ? currentValidity
        : { ...currentValidity, [questionId]: isValid },
    );
  }

  function applyEssayImageMutation(
    questionId: string,
    result: Awaited<ReturnType<typeof uploadStudentEssayImage>>["data"],
  ) {
    answerRevisionRef.current = Math.max(
      answerRevisionRef.current,
      result.attempt.answerRevision,
    );
    setAnswers((currentAnswers) =>
      mergePersistedEssayImageAnswer(
        currentAnswers,
        result.attempt.answers,
        questionId,
      ),
    );
    setContext((currentContext) => ({
      ...currentContext,
      serverNow: result.serverNow,
      canEditAnswers: result.canEditAnswers,
      attempt: {
        ...currentContext.attempt,
        status: result.attempt.status,
        answerRevision: answerRevisionRef.current,
        submittedAt: result.attempt.submittedAt,
        lastSavedAt: result.attempt.lastSavedAt,
      },
    }));
  }

  async function handleEssayImageUpload(questionId: string, file: File) {
    setActiveEssayImageMutations((count) => count + 1);

    try {
      const response = await uploadStudentEssayImage(
        exam.id,
        initialAttempt.id,
        questionId,
        file,
      );

      if (isMountedRef.current) {
        applyEssayImageMutation(questionId, response.data);
      }
    } finally {
      if (isMountedRef.current) {
        setActiveEssayImageMutations((count) => Math.max(0, count - 1));
      }
    }
  }

  async function handleEssayImageRemove(questionId: string, publicId: string) {
    setActiveEssayImageMutations((count) => count + 1);

    try {
      const response = await removeStudentEssayImage(
        exam.id,
        initialAttempt.id,
        questionId,
        publicId,
      );

      if (isMountedRef.current) {
        applyEssayImageMutation(questionId, response.data);
      }
    } finally {
      if (isMountedRef.current) {
        setActiveEssayImageMutations((count) => Math.max(0, count - 1));
      }
    }
  }

  function beginIntentionalFilePickerInteraction() {
    intentionalFilePickerRef.current = {
      active: true,
      wasFullscreen: isDocumentElementFullscreen(),
    };
  }

  function finishIntentionalFilePickerInteraction() {
    const interaction = intentionalFilePickerRef.current;

    if (!interaction.active) {
      return;
    }

    const fullscreenWasLost =
      interaction.wasFullscreen && !isDocumentElementFullscreen();

    if (fullscreenWasLost) {
      const transition = advanceExamFullscreenTracking(
        fullscreenTrackingRef.current,
        false,
        true,
      );
      fullscreenTrackingRef.current = transition.state;
      setIsFullscreen(false);
      setEnvironmentWarning((currentWarning) =>
        currentWarning === "FULLSCREEN_SUBMIT"
          ? currentWarning
          : "FILE_PICKER_FULLSCREEN",
      );
    }

    intentionalFilePickerRef.current = {
      active: false,
      wasFullscreen: false,
    };
  }

  async function handleFullscreenToggle() {
    if (
      expirationStartedRef.current ||
      isExpirationPending ||
      hasCountdownExpired ||
      isSubmitting ||
      activeEssayImageMutations > 0
    ) {
      return;
    }

    setFullscreenError(null);

    if (isFullscreen) {
      setIsFullscreenExitDialogOpen(true);
      return;
    }

    const succeeded = await requestDocumentFullscreen();

    if (!succeeded) {
      setFullscreenError(
        "Trình duyệt không thể thay đổi chế độ toàn màn hình. Bạn vẫn có thể tiếp tục làm bài.",
      );
    }
  }

  async function handleConfirmedFullscreenExit() {
    if (isChangingFullscreenForExit || expirationStartedRef.current) {
      setIsFullscreenExitDialogOpen(false);
      return;
    }

    setFullscreenError(null);

    if (!isDocumentElementFullscreen()) {
      setIsFullscreenExitDialogOpen(false);
      return;
    }

    setIsChangingFullscreenForExit(true);

    try {
      if (!(await exitDocumentFullscreen())) {
        setFullscreenError(
          "Trình duyệt không thể thoát chế độ toàn màn hình. Bài thi chưa được nộp.",
        );
      }
    } finally {
      setIsChangingFullscreenForExit(false);
    }
  }

  function handleCancelFullscreenExit() {
    setFullscreenError(null);
    setIsFullscreenExitDialogOpen(false);
  }

  async function handleReturnToFullscreen() {
    setFullscreenError(null);

    if (await requestDocumentFullscreen()) {
      setEnvironmentWarning(null);
      return;
    }

    setFullscreenError(
      "Trình duyệt không thể mở toàn màn hình. Bạn vẫn có thể tiếp tục làm bài.",
    );
  }

  async function submitFullscreenExitAnswers(
    answerSnapshot: ExamAttemptAnswers,
  ) {
    if (finalSubmissionInFlightRef.current) {
      return;
    }

    finalSubmissionInFlightRef.current = true;
    setIsSubmitting(true);
    setIsSubmitDialogOpen(false);
    setEnvironmentWarning("FULLSCREEN_SUBMIT");
    setFullscreenSubmissionError(null);

    try {
      await autosave.flush().catch(() => undefined);
      autosave.pause();
      const response = await submitStudentExamAttempt(
        exam.id,
        initialAttempt.id,
        answerSnapshot,
        answerRevisionRef.current,
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
      router.replace(getResultHref(exam.id, initialAttempt.id));
    } catch (error) {
      const errorMessage = getRequestError(
        error,
        "Không thể nộp bài sau khi thoát toàn màn hình. Vui lòng thử lại.",
      );
      const adoptedTerminalAttempt = await adoptTerminalAttemptIfAvailable();

      if (!isMountedRef.current || adoptedTerminalAttempt) {
        return;
      }

      finalSubmissionInFlightRef.current = false;
      setFullscreenSubmissionError(errorMessage);
      autosave.resume();
    }
  }

  function retryFullscreenExitSubmission() {
    const answerSnapshot = fullscreenExitAnswersRef.current;

    if (answerSnapshot) {
      void submitFullscreenExitAnswers(answerSnapshot);
    }
  }

  function beginFullscreenExitSubmission(answerSnapshot: ExamAttemptAnswers) {
    if (finalSubmissionInFlightRef.current || expirationStartedRef.current) {
      return;
    }

    fullscreenExitAnswersRef.current = answerSnapshot;
    setIsSubmitting(true);
    setIsSubmitDialogOpen(false);
    setIsFullscreenExitDialogOpen(false);
    setEnvironmentWarning("FULLSCREEN_SUBMIT");
    setFullscreenSubmissionError(null);
    void submitFullscreenExitAnswers(answerSnapshot);
  }

  const handleFullscreenExitTransition = useEffectEvent(() => {
    if (
      context.attempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS ||
      !context.canEditAnswers ||
      expirationStartedRef.current ||
      finalSubmissionInFlightRef.current
    ) {
      return;
    }

    beginFullscreenExitSubmission(answers);
  });

  function navigateToQuestion(targetId: string, questionId: string) {
    const answerSheet = answerSheetRef.current;
    const target = document.getElementById(targetId);

    if (!answerSheet || !target || !answerSheet.contains(target)) {
      return;
    }

    setCurrentQuestionId(questionId);

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
    if (
      !isMountedRef.current ||
      autoSubmitInFlightRef.current ||
      finalSubmissionInFlightRef.current
    ) {
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
    setIsFullscreenExitDialogOpen(false);
    setSubmissionError(null);

    if (finalSubmissionInFlightRef.current) {
      setHasCountdownExpired(true);
      setIsExpirationPending(false);
      return;
    }

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
      finalSubmissionInFlightRef.current ||
      expirationStartedRef.current ||
      isSubmitting ||
      hasCountdownExpired ||
      isExpirationPending ||
      !canSubmitAnswers
    ) {
      return;
    }

    finalSubmissionInFlightRef.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      await autosave.flush().catch(() => undefined);
      autosave.pause();
      const response = await submitStudentExamAttempt(
        exam.id,
        initialAttempt.id,
        answers,
        answerRevisionRef.current,
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

      finalSubmissionInFlightRef.current = false;

      if (fullscreenTrackingRef.current.exitHandled) {
        fullscreenExitAnswersRef.current = answers;
        setIsSubmitDialogOpen(false);
        setEnvironmentWarning("FULLSCREEN_SUBMIT");
        setFullscreenSubmissionError(errorMessage);
      } else {
        setSubmissionError(errorMessage);
        setIsSubmitting(false);
        autosave.resume();

        if (expirationStartedRef.current) {
          void finalizeAfterExpiration();
        }
      }
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
    const initialIsFullscreen = isDocumentElementFullscreen();
    fullscreenTrackingRef.current =
      createExamFullscreenTrackingState(initialIsFullscreen);
    leftExamScreenRef.current = document.hidden;

    function handleFullscreenChange() {
      const nextIsFullscreen = isDocumentElementFullscreen();
      const transition = advanceExamFullscreenTracking(
        fullscreenTrackingRef.current,
        nextIsFullscreen,
        intentionalFilePickerRef.current.active &&
          intentionalFilePickerRef.current.wasFullscreen &&
          !nextIsFullscreen,
      );
      fullscreenTrackingRef.current = transition.state;
      setIsFullscreen(nextIsFullscreen);

      if (nextIsFullscreen) {
        setFullscreenError(null);
      }

      if (transition.shouldHandleExit) {
        handleFullscreenExitTransition();
      }
    }

    function handleVisibilityChange() {
      if (intentionalFilePickerRef.current.active) {
        leftExamScreenRef.current = false;
        return;
      }

      if (document.hidden) {
        leftExamScreenRef.current = true;
        return;
      }

      if (leftExamScreenRef.current) {
        leftExamScreenRef.current = false;
        setEnvironmentWarning((currentWarning) =>
          currentWarning === "FULLSCREEN_SUBMIT"
            ? currentWarning
            : "PAGE_HIDDEN",
        );
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const initialStateFrame = window.requestAnimationFrame(() => {
      setIsFullscreen(isDocumentElementFullscreen());
      setFullscreenSupported(isFullscreenSupported());
    });

    return () => {
      window.cancelAnimationFrame(initialStateFrame);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
        open={isFullscreenExitDialogOpen}
        onOpenChange={(open) => {
          if (!isChangingFullscreenForExit) {
            setIsFullscreenExitDialogOpen(open);

            if (!open) {
              setFullscreenError(null);
            }
          }
        }}
      >
        <AlertDialogContent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            fullscreenExitCancelButtonRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            fullscreenButtonRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Thoát toàn màn hình và nộp bài?</AlertDialogTitle>
            <AlertDialogDescription>
              Nếu xác nhận, hệ thống sẽ thoát chế độ toàn màn hình và nộp ngay
              toàn bộ câu trả lời hiện tại. Sau khi nộp, bạn không thể chỉnh sửa
              câu trả lời. Nếu thoát bằng Esc hoặc điều khiển của trình duyệt,
              hệ thống cũng sẽ tự động nộp bài ngay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {fullscreenError && (
            <p role="alert" className="text-destructive text-sm">
              {fullscreenError}
            </p>
          )}
          <AlertDialogFooter>
            <Button
              ref={fullscreenExitCancelButtonRef}
              type="button"
              variant="outline"
              disabled={isChangingFullscreenForExit}
              onClick={handleCancelFullscreenExit}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isChangingFullscreenForExit}
              onClick={() => void handleConfirmedFullscreenExit()}
            >
              {isChangingFullscreenForExit
                ? "Đang xử lý..."
                : "Thoát và nộp bài"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={
          Boolean(environmentWarning) &&
          !isSubmitDialogOpen &&
          !isFullscreenExitDialogOpen
        }
        onOpenChange={(open) => {
          if (
            !open &&
            environmentWarning === "FILE_PICKER_FULLSCREEN" &&
            fullscreenSupported &&
            !fullscreenError
          ) {
            return;
          }

          if (!open && environmentWarning !== "FULLSCREEN_SUBMIT") {
            setEnvironmentWarning(null);
            setFullscreenError(null);
          }
        }}
      >
        <AlertDialogContent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            environmentDialogDescriptionRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            fullscreenButtonRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {environmentWarning === "FULLSCREEN_SUBMIT"
                ? "Đang nộp bài do thoát toàn màn hình"
                : environmentWarning === "FILE_PICKER_FULLSCREEN"
                  ? "Vui lòng quay lại toàn màn hình"
                  : "Bạn đã rời màn hình làm bài"}
            </AlertDialogTitle>
            <AlertDialogDescription
              ref={environmentDialogDescriptionRef}
              tabIndex={-1}
            >
              {environmentWarning === "FULLSCREEN_SUBMIT"
                ? "Bạn đã thoát chế độ toàn màn hình. Phiếu trả lời hiện tại đã được khóa và đang được gửi để nộp bài."
                : environmentWarning === "FILE_PICKER_FULLSCREEN"
                  ? "Trình chọn tệp đã làm gián đoạn chế độ toàn màn hình. Ảnh đã chọn vẫn được xử lý; hãy mở lại toàn màn hình để tiếp tục làm bài."
                  : "Trang thi đã bị ẩn khi bạn chuyển tab, cửa sổ hoặc ứng dụng. Lượt làm bài và đồng hồ vẫn tiếp tục bình thường; hệ thống không tự động nộp bài hoặc thay đổi điểm."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {environmentWarning !== "FULLSCREEN_SUBMIT" && fullscreenError && (
            <p role="alert" className="text-destructive text-sm">
              {fullscreenError}
            </p>
          )}
          {environmentWarning === "FULLSCREEN_SUBMIT" ? (
            fullscreenSubmissionError && (
              <>
                <p role="alert" className="text-destructive text-sm">
                  {fullscreenSubmissionError}
                </p>
                <AlertDialogFooter>
                  <Button type="button" onClick={retryFullscreenExitSubmission}>
                    Thử nộp lại
                  </Button>
                </AlertDialogFooter>
              </>
            )
          ) : (
            <AlertDialogFooter>
              {(environmentWarning !== "FILE_PICKER_FULLSCREEN" ||
                !fullscreenSupported ||
                fullscreenError) && (
                <AlertDialogCancel>Tiếp tục làm bài</AlertDialogCancel>
              )}
              <Button
                type="button"
                disabled={!fullscreenSupported}
                onClick={() => void handleReturnToFullscreen()}
              >
                Quay lại toàn màn hình
              </Button>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>

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

      <div className="flex h-full min-h-0 flex-col gap-2">
        <header className="border-border bg-card sticky top-0 z-20 flex min-h-14 shrink-0 items-center rounded-xl border px-3 py-2 shadow-sm lg:static">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h1
              className="min-w-0 flex-[1_1_14rem] truncate text-sm font-semibold sm:text-base"
              title={`${context.exam.title} · Lần làm ${context.attempt.attemptNumber}`}
            >
              {context.exam.title}
              <span className="text-muted-foreground hidden font-normal sm:inline">
                {" "}
                · Lần làm {context.attempt.attemptNumber}
              </span>
            </h1>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="border-border bg-muted/40 flex h-9 items-center gap-2 rounded-lg border px-2.5">
                <ClockIcon />
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  Còn lại
                </span>
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
              <AutosaveIndicator status={autosave.status} />
              <Button
                ref={fullscreenButtonRef}
                type="button"
                size="icon"
                variant="outline"
                disabled={
                  !fullscreenSupported ||
                  isChangingFullscreenForExit ||
                  isSubmitting ||
                  isExpirationPending ||
                  hasCountdownExpired ||
                  activeEssayImageMutations > 0
                }
                aria-label={
                  isFullscreen
                    ? "Thoát toàn màn hình và nộp bài"
                    : "Mở chế độ toàn màn hình"
                }
                title={
                  fullscreenSupported
                    ? isFullscreen
                      ? "Thoát toàn màn hình và nộp bài"
                      : "Mở toàn màn hình"
                    : "Trình duyệt không hỗ trợ toàn màn hình"
                }
                className="size-9"
                onClick={() => void handleFullscreenToggle()}
              >
                <FullscreenIcon active={isFullscreen} />
              </Button>
              <Button
                ref={submitButtonRef}
                type="button"
                disabled={
                  isSubmitting ||
                  hasCountdownExpired ||
                  isExpirationPending ||
                  !canSubmitAnswers
                }
                title={
                  canSubmitAnswers
                    ? undefined
                    : activeEssayImageMutations > 0
                      ? "Hãy chờ thao tác ảnh hoàn tất."
                      : "Hãy hoàn thành hoặc xóa đáp án trả lời ngắn chưa hợp lệ."
                }
                onClick={() => setIsSubmitDialogOpen(true)}
                className="h-9 px-3"
              >
                <span className="sm:hidden">Nộp</span>
                <span className="hidden sm:inline">Nộp bài</span>
              </Button>
            </div>
          </div>
        </header>

        {fullscreenError &&
          !environmentWarning &&
          !isFullscreenExitDialogOpen && (
            <p
              role="alert"
              className="border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {fullscreenError}
            </p>
          )}

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

        <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)] xl:grid-cols-[minmax(0,5fr)_minmax(24rem,3fr)]">
          <section
            aria-labelledby="exam-pdf-heading"
            className="border-border bg-card flex min-h-[65dvh] flex-col overflow-hidden rounded-xl border shadow-sm lg:min-h-0"
          >
            <div className="border-border bg-muted/25 flex h-9 shrink-0 items-center gap-2 border-b px-3">
              <h2
                id="exam-pdf-heading"
                className="shrink-0 text-xs font-semibold"
              >
                Đề thi PDF
              </h2>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <p
                className="text-muted-foreground min-w-0 truncate text-xs"
                title={context.exam.pdf.filename}
              >
                {context.exam.pdf.filename}
              </p>
            </div>
            {pdfLoadState === "loading" && (
              <div role="status" className="px-3 py-2">
                <span className="sr-only">Đang tải đề thi PDF</span>
                <Skeleton className="h-1.5 w-full" />
              </div>
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
            className="border-border bg-muted/20 min-h-0 rounded-xl border shadow-sm lg:h-full lg:overflow-y-auto lg:overscroll-contain"
          >
            <div
              ref={answerSheetHeaderRef}
              className="border-border bg-background/95 z-10 space-y-3 rounded-t-xl border-b p-3.5 backdrop-blur-sm lg:sticky lg:top-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="answer-sheet-heading" className="font-semibold">
                    Phiếu trả lời
                  </h2>
                  <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-3 rounded-sm border border-emerald-600 bg-emerald-600"
                        aria-hidden="true"
                      />
                      Đã trả lời
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="border-input size-3 rounded-sm border border-dashed"
                        aria-hidden="true"
                      />
                      Chưa trả lời
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-amber-700 dark:text-amber-300">
                        <FlagIcon filled />
                      </span>
                      Đã đánh dấu
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                    {progress.answeredQuestions}/{progress.totalQuestions}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                    <FlagIcon filled />
                    {flaggedQuestionIds.size} đánh dấu
                  </span>
                </div>
              </div>
              <div
                className="bg-muted h-1.5 overflow-hidden rounded-full"
                role="progressbar"
                aria-label="Tiến độ trả lời"
                aria-valuemin={0}
                aria-valuemax={progress.totalQuestions}
                aria-valuenow={progress.answeredQuestions}
              >
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] motion-reduce:transition-none"
                  style={{
                    width: `${progress.totalQuestions === 0 ? 0 : (progress.answeredQuestions / progress.totalQuestions) * 100}%`,
                  }}
                />
              </div>
              {dynamicProgress && exam.structureSnapshot ? (
                <DynamicQuestionOverview
                  structure={exam.structureSnapshot}
                  progress={dynamicProgress}
                  flaggedQuestionIds={flaggedQuestionIds}
                  currentQuestionId={currentQuestionId}
                  onQuestionSelect={navigateToQuestion}
                />
              ) : legacyProgress ? (
                <QuestionOverview
                  progress={legacyProgress}
                  flaggedQuestionIds={flaggedQuestionIds}
                  currentQuestionId={currentQuestionId}
                  onQuestionSelect={navigateToQuestion}
                />
              ) : null}
              {flagError && (
                <div
                  role="alert"
                  className="border-destructive/30 bg-destructive/5 text-destructive flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs"
                >
                  <span>{flagError}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 px-2"
                    onClick={retryQuestionFlags}
                  >
                    Thử lại
                  </Button>
                </div>
              )}
              {!canSubmitAnswers && (
                <p role="alert" className="text-destructive text-xs leading-5">
                  Có đáp án trả lời ngắn chưa hợp lệ. Hãy hoàn thành giá trị
                  hoặc xóa nội dung đang nhập để tiếp tục lưu.
                </p>
              )}
              <p className="text-muted-foreground text-xs leading-5">
                Câu trả lời được tự động lưu khi bạn ngừng thao tác trong giây
                lát.
              </p>
            </div>

            {dynamicAnswers && dynamicProgress && exam.structureSnapshot ? (
              <DynamicAnswerSheet
                structure={exam.structureSnapshot}
                answers={dynamicAnswers}
                updateAnswer={(questionId, answer) =>
                  setAnswers((currentAnswers) =>
                    isDynamicAttemptAnswers(currentAnswers)
                      ? {
                          answersByQuestionId: {
                            ...currentAnswers.answersByQuestionId,
                            [questionId]: answer,
                          },
                        }
                      : currentAnswers,
                  )
                }
                disabled={
                  hasCountdownExpired || isExpirationPending || isSubmitting
                }
                progress={dynamicProgress}
                shortAnswerInputMode={
                  exam.shortAnswerInputMode ?? exam.part3InputMode
                }
                onShortAnswerTextValidityChange={
                  setDynamicShortAnswerTextValidity
                }
                onEssayImageUpload={handleEssayImageUpload}
                onEssayImageRemove={handleEssayImageRemove}
                onFilePickerOpen={beginIntentionalFilePickerInteraction}
                onFilePickerReturn={finishIntentionalFilePickerInteraction}
                flaggedQuestionIds={flaggedQuestionIds}
                pendingFlagQuestionIds={pendingFlagQuestionIds}
                onToggleQuestionFlag={toggleQuestionFlag}
              />
            ) : legacyAnswers && legacyProgress ? (
              <AnswerSheet
                answers={legacyAnswers}
                updateAnswers={(updater) =>
                  setAnswers((currentAnswers) =>
                    isDynamicAttemptAnswers(currentAnswers)
                      ? currentAnswers
                      : updater(currentAnswers),
                  )
                }
                disabled={
                  hasCountdownExpired || isExpirationPending || isSubmitting
                }
                progress={legacyProgress}
                part3InputMode={exam.part3InputMode}
                onPartThreeTextValidityChange={setPartThreeTextAnswerValidity}
                flaggedQuestionIds={flaggedQuestionIds}
                pendingFlagQuestionIds={pendingFlagQuestionIds}
                onToggleQuestionFlag={toggleQuestionFlag}
              />
            ) : (
              <p role="alert" className="text-destructive p-4 text-sm">
                Phiếu trả lời không khớp với cấu trúc đề thi.
              </p>
            )}
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
    return <ExamWorkspaceSkeleton />;
  }

  if (!context.canEditAnswers) {
    return <EndedAttempt context={context} />;
  }

  return <ActiveAttemptWorkspace initialContext={context} />;
}
