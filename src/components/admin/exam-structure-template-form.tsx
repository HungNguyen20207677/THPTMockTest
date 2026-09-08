"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createExamStructureTemplateRecord,
  updateExamStructureTemplateRecord,
} from "@/lib/api/exam-structure-templates";
import { ApiClientError } from "@/lib/api/client";
import {
  EXAM_STRUCTURE_MAX_QUESTIONS_PER_SECTION,
  EXAM_STRUCTURE_MAX_SECTIONS,
  EXAM_STRUCTURE_MAX_TOTAL_QUESTIONS,
  EXAM_STRUCTURE_QUESTION_TYPE,
  EXAM_STRUCTURE_QUESTION_TYPES,
  EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS,
} from "@/lib/constants/exam-structure-template";
import { scoreFormatter } from "@/lib/formatting";
import {
  examStructureTemplateEditorSchema,
  parseExamStructureScorePointsToHundredths,
  type ExamStructureTemplateEditorInput,
  type ExamStructureTemplateEditorOutput,
} from "@/lib/validations/exam-structure-template";
import type {
  ExamStructureQuestionType,
  ExamStructureTemplate,
} from "@/types/exam-structure-template";

const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50";

const questionTypeLabels: Record<ExamStructureQuestionType, string> = {
  SINGLE_CHOICE: "Trắc nghiệm một đáp án",
  TRUE_FALSE: "Đúng/Sai",
  SHORT_ANSWER: "Trả lời ngắn",
  ESSAY_IMAGE: "Tự luận bằng hình ảnh",
};

interface ExamStructureTemplateFormProps {
  template?: ExamStructureTemplate;
  onCancel: () => void;
  onSaved: () => void;
}

function createClientStructureId(prefix: "section" | "question"): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function createEmptyQuestion(id = "question-new-1") {
  return {
    id,
    type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
    maxScore: "0.25",
  };
}

function createEmptyEditorValues(): ExamStructureTemplateEditorInput {
  return {
    name: "",
    sections: [
      {
        id: "section-new-1",
        title: "Phần I",
        questions: [{ ...createEmptyQuestion(), maxScore: "10.00" }],
      },
    ],
  };
}

function toEditorValues(
  template: ExamStructureTemplate,
): ExamStructureTemplateEditorInput {
  return {
    name: template.name,
    sections: template.sections.map((section) => ({
      id: section.id,
      title: section.title,
      questions: section.questions.map((question) => ({
        id: question.id,
        type: question.type,
        maxScore: (question.maxScoreHundredths / 100).toFixed(2),
      })),
    })),
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

  return "Không thể lưu mẫu cấu trúc. Vui lòng thử lại.";
}

function parseEditorScoreHundredths(value: string | undefined): number {
  return value ? (parseExamStructureScorePointsToHundredths(value) ?? 0) : 0;
}

interface SectionQuestionsProps {
  sectionIndex: number;
  control: Control<
    ExamStructureTemplateEditorInput,
    unknown,
    ExamStructureTemplateEditorOutput
  >;
  register: UseFormRegister<ExamStructureTemplateEditorInput>;
  errors: FieldErrors<ExamStructureTemplateEditorInput>;
  canAddQuestion: boolean;
}

function SectionQuestions({
  sectionIndex,
  control,
  register,
  errors,
  canAddQuestion,
}: SectionQuestionsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `sections.${sectionIndex}.questions`,
    keyName: "fieldKey",
  });
  const questionsError = errors.sections?.[sectionIndex]?.questions;
  const questionsErrorMessage =
    questionsError?.root?.message ?? questionsError?.message;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">Câu hỏi</h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            !canAddQuestion ||
            fields.length >= EXAM_STRUCTURE_MAX_QUESTIONS_PER_SECTION
          }
          onClick={() =>
            append(createEmptyQuestion(createClientStructureId("question")))
          }
        >
          Thêm câu hỏi
        </Button>
      </div>

      {fields.map((question, questionIndex) => {
        const questionErrors = questionsError?.[questionIndex];
        const typeId = `section-${sectionIndex}-question-${questionIndex}-type`;
        const typeErrorId = `${typeId}-error`;
        const scoreId = `section-${sectionIndex}-question-${questionIndex}-score`;

        return (
          <div
            key={question.fieldKey}
            className="border-border grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(9rem,0.4fr)_auto] md:items-end"
          >
            <input
              type="hidden"
              {...register(
                `sections.${sectionIndex}.questions.${questionIndex}.id`,
              )}
            />
            <div className="space-y-2">
              <Label htmlFor={typeId}>
                Câu {questionIndex + 1}: Loại câu hỏi
              </Label>
              <select
                id={typeId}
                className={selectClassName}
                aria-invalid={Boolean(questionErrors?.type)}
                aria-describedby={
                  questionErrors?.type ? typeErrorId : undefined
                }
                {...register(
                  `sections.${sectionIndex}.questions.${questionIndex}.type`,
                )}
              >
                {EXAM_STRUCTURE_QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {questionTypeLabels[type]}
                  </option>
                ))}
              </select>
              {questionErrors?.type && (
                <p id={typeErrorId} className="text-destructive text-sm">
                  {questionErrors.type.message}
                </p>
              )}
              {questionErrors?.id && (
                <p className="text-destructive text-sm">
                  {questionErrors.id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={scoreId}>Điểm tối đa</Label>
              <Input
                id={scoreId}
                type="text"
                inputMode="decimal"
                placeholder="0,25"
                aria-invalid={Boolean(questionErrors?.maxScore)}
                aria-describedby={
                  questionErrors?.maxScore ? `${scoreId}-error` : undefined
                }
                {...register(
                  `sections.${sectionIndex}.questions.${questionIndex}.maxScore`,
                )}
              />
              {questionErrors?.maxScore && (
                <p id={`${scoreId}-error`} className="text-destructive text-sm">
                  {questionErrors.maxScore.message}
                </p>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Xóa câu ${questionIndex + 1} khỏi phần ${sectionIndex + 1}`}
              onClick={() => remove(questionIndex)}
            >
              Xóa câu
            </Button>
          </div>
        );
      })}

      {questionsErrorMessage && (
        <p className="text-destructive text-sm">{questionsErrorMessage}</p>
      )}
    </div>
  );
}

export function ExamStructureTemplateForm({
  template,
  onCancel,
  onSaved,
}: ExamStructureTemplateFormProps) {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<
    ExamStructureTemplateEditorInput,
    unknown,
    ExamStructureTemplateEditorOutput
  >({
    resolver: zodResolver(examStructureTemplateEditorSchema),
    defaultValues: template
      ? toEditorValues(template)
      : createEmptyEditorValues(),
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "sections",
    keyName: "fieldKey",
  });
  const watchedSections = useWatch({ control, name: "sections" }) ?? [];
  const totalScoreHundredths = watchedSections.reduce(
    (total, section) =>
      total +
      (section.questions ?? []).reduce(
        (sectionTotal, question) =>
          sectionTotal + parseEditorScoreHundredths(question.maxScore),
        0,
      ),
    0,
  );
  const totalQuestionCount = watchedSections.reduce(
    (total, section) => total + (section.questions?.length ?? 0),
    0,
  );
  const hasRequiredTotal =
    totalScoreHundredths === EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS;
  const sectionsErrorMessage =
    errors.sections?.root?.message ?? errors.sections?.message;

  const onSubmit = handleSubmit(async (input) => {
    setSubmissionError(null);

    try {
      if (template) {
        await updateExamStructureTemplateRecord(template.id, {
          ...input,
          expectedUpdatedAt: template.updatedAt,
        });
      } else {
        await createExamStructureTemplateRecord(input);
      }

      onSaved();
    } catch (error) {
      setSubmissionError(getRequestError(error));
    }
  });

  return (
    <section className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">
          {template ? "Chỉnh sửa mẫu cấu trúc" : "Tạo mẫu cấu trúc"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Thứ tự các phần và câu hỏi được lưu theo thứ tự hiển thị bên dưới.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <fieldset disabled={isSubmitting} className="contents">
          <div className="space-y-2">
            <Label htmlFor="template-name">Tên mẫu</Label>
            <Input
              id="template-name"
              autoFocus
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "template-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="template-name-error" className="text-destructive text-sm">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Các phần</h3>
              <Button
                type="button"
                variant="outline"
                disabled={
                  fields.length >= EXAM_STRUCTURE_MAX_SECTIONS ||
                  totalQuestionCount >= EXAM_STRUCTURE_MAX_TOTAL_QUESTIONS
                }
                onClick={() => {
                  const nextSectionNumber = fields.length + 1;
                  append({
                    id: createClientStructureId("section"),
                    title: `Phần ${nextSectionNumber}`,
                    questions: [
                      createEmptyQuestion(createClientStructureId("question")),
                    ],
                  });
                }}
              >
                Thêm phần
              </Button>
            </div>

            {fields.map((section, sectionIndex) => {
              const titleId = `template-section-${sectionIndex}-title`;
              const sectionErrors = errors.sections?.[sectionIndex];

              return (
                <section
                  key={section.fieldKey}
                  className="border-border bg-muted/20 space-y-4 rounded-xl border p-4"
                >
                  <input
                    type="hidden"
                    {...register(`sections.${sectionIndex}.id`)}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label htmlFor={titleId}>Tên phần</Label>
                      <Input
                        id={titleId}
                        required
                        aria-invalid={Boolean(sectionErrors?.title)}
                        aria-describedby={
                          sectionErrors?.title ? `${titleId}-error` : undefined
                        }
                        {...register(`sections.${sectionIndex}.title`)}
                      />
                      {sectionErrors?.title && (
                        <p
                          id={`${titleId}-error`}
                          className="text-destructive text-sm"
                        >
                          {sectionErrors.title.message}
                        </p>
                      )}
                      {sectionErrors?.id && (
                        <p className="text-destructive text-sm">
                          {sectionErrors.id.message}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Xóa phần ${sectionIndex + 1}`}
                      onClick={() => remove(sectionIndex)}
                    >
                      Xóa phần
                    </Button>
                  </div>

                  <SectionQuestions
                    sectionIndex={sectionIndex}
                    control={control}
                    register={register}
                    errors={errors}
                    canAddQuestion={
                      totalQuestionCount < EXAM_STRUCTURE_MAX_TOTAL_QUESTIONS
                    }
                  />
                </section>
              );
            })}

            {sectionsErrorMessage && (
              <p className="text-destructive text-sm">{sectionsErrorMessage}</p>
            )}
          </div>

          <div
            aria-live="polite"
            className={`rounded-lg border px-4 py-3 text-sm ${
              hasRequiredTotal
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-amber-300 bg-amber-50 text-amber-800"
            }`}
          >
            Tổng điểm hiện tại:{" "}
            <strong>
              {scoreFormatter.format(totalScoreHundredths / 100)} điểm
            </strong>
            . Yêu cầu: <strong>10,00 điểm</strong>.
          </div>

          {submissionError && (
            <p role="alert" className="text-destructive text-sm">
              {submissionError}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Đang lưu..."
                : template
                  ? "Lưu thay đổi"
                  : "Tạo mẫu"}
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
        </fieldset>
      </form>
    </section>
  );
}
