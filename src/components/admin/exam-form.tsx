"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { QuestionTopicSelector } from "@/components/admin/question-topic-selector";
import { ShortAnswerBubbleInput } from "@/components/exam/short-answer-bubble-input";
import { ShortAnswerTextInput } from "@/components/exam/short-answer-text-input";
import { ExamFormSkeleton } from "@/components/shared/loading-skeletons";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api/client";
import { fetchExamStructureTemplates } from "@/lib/api/exam-structure-templates";
import { createExamRecord, fetchExam, updateExamRecord } from "@/lib/api/exams";
import { fetchStudents } from "@/lib/api/students";
import { createTopicRecord, fetchTopics } from "@/lib/api/topics";
import {
  EXAM_STATUSES,
  EXAM_STATUS,
  EXAM_STRUCTURE,
  EXAM_VISIBILITY_MODE,
  PART3_INPUT_MODE,
  PART3_INPUT_MODES,
  PART_ONE_CHOICES,
  PART_TWO_STATEMENTS,
} from "@/lib/constants/exam";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import {
  areExamAnswerKeysEqual,
  isDynamicExamAnswerKey,
} from "@/lib/exam/answer-key";
import { createEmptyQuestionTopicIds } from "@/lib/exam/question-topics";
import {
  canonicalShortAnswerToSlots,
  createEmptyShortAnswerSlots,
} from "@/lib/exam/short-answer";
import {
  createDynamicExamAnswerKeySchema,
  examEditorSchema,
  type ExamEditorInput,
  type ExamEditorOutput,
} from "@/lib/validations/exam";
import { getExamPdfValidationError } from "@/lib/validations/exam-pdf";
import type {
  AnyExamAnswerKey,
  ExamDetail,
  ExamPdf,
  Part3InputMode,
  PartOneAnswer,
  ShortAnswerSlots,
} from "@/types/exam";
import type {
  ExamStructureSnapshot,
  ExamStructureTemplate,
} from "@/types/exam-structure-template";
import type { StudentAccount } from "@/types/user";
import type { Topic } from "@/types/topic";

const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50";

const statusLabels = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  HIDDEN: "Đã ẩn",
} as const;

const part3InputModeLabels = {
  BUBBLE: "Tô 4 ô ký tự",
  TEXT: "Nhập bằng ô văn bản",
} as const;

type ExamFormProps =
  { mode: "create"; examId?: never } | { mode: "edit"; examId: string };

type DynamicEditorAnswer =
  | ""
  | PartOneAnswer
  | ShortAnswerSlots
  | {
      a: boolean | null;
      b: boolean | null;
      c: boolean | null;
      d: boolean | null;
    };

function createEmptyDynamicAnswerKey(structure: ExamStructureSnapshot): {
  answersByQuestionId: Record<string, DynamicEditorAnswer>;
} {
  return {
    answersByQuestionId: Object.fromEntries(
      structure.sections.flatMap((section) =>
        section.questions.map((question) => [
          question.id,
          question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE
            ? { a: null, b: null, c: null, d: null }
            : question.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER
              ? createEmptyShortAnswerSlots()
              : "",
        ]),
      ),
    ),
  };
}

function createEmptyEditorValues(mode: ExamFormProps["mode"]): ExamEditorInput {
  const commonValues = {
    title: "",
    description: "",
    status: EXAM_STATUS.DRAFT,
    visibilityMode: EXAM_VISIBILITY_MODE.ALL_STUDENTS,
    assignedStudentIds: [],
    part3InputMode: PART3_INPUT_MODE.BUBBLE,
    settings: {
      allowRetake: true,
      showScoreAfterSubmission: true,
      showAnswersAfterSubmission: false,
    },
    questionTopicIds: createEmptyQuestionTopicIds(),
  };

  if (mode === "create") {
    return {
      ...commonValues,
      structureTemplateId: "",
      answerKey: { answersByQuestionId: {} },
    };
  }

  return {
    ...commonValues,
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
  const commonValues = {
    title: exam.title,
    description: exam.description ?? "",
    status: exam.status,
    visibilityMode: exam.visibilityMode,
    assignedStudentIds: [...exam.assignedStudentIds],
    part3InputMode: exam.part3InputMode,
    settings: { ...exam.settings },
    questionTopicIds: {
      partOne: exam.questionTopicIds.partOne.map((topicIds) => [...topicIds]),
      partTwo: exam.questionTopicIds.partTwo.map((topicIds) => [...topicIds]),
      partThree: exam.questionTopicIds.partThree.map((topicIds) => [
        ...topicIds,
      ]),
    },
  };

  if (exam.structureSnapshot && isDynamicExamAnswerKey(exam.answerKey)) {
    const answersByQuestionId: Record<string, DynamicEditorAnswer> = {};

    for (const section of exam.structureSnapshot.sections) {
      for (const question of section.questions) {
        const answer = exam.answerKey.answersByQuestionId[question.id];

        answersByQuestionId[question.id] =
          question.type === EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE &&
          typeof answer === "object"
            ? { ...answer }
            : question.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER &&
                typeof answer === "string"
              ? (canonicalShortAnswerToSlots(answer) ??
                createEmptyShortAnswerSlots())
              : question.type === EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE &&
                  typeof answer === "string" &&
                  PART_ONE_CHOICES.some((choice) => choice === answer)
                ? (answer as PartOneAnswer)
                : "";
      }
    }

    return {
      ...commonValues,
      structureTemplateId: exam.structureTemplateId ?? "",
      answerKey: { answersByQuestionId },
    };
  }

  if (isDynamicExamAnswerKey(exam.answerKey)) {
    throw new Error("Dynamic exam structure is missing.");
  }

  return {
    ...commonValues,
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

function getRequestError(
  error: unknown,
  fallback = "Không thể lưu đề thi. Vui lòng thử lại.",
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

export function ExamForm({ mode, examId }: ExamFormProps) {
  const router = useRouter();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentPdf, setCurrentPdf] = useState<ExamPdf | null>(null);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(null);
  const [initialAnswerKey, setInitialAnswerKey] =
    useState<AnyExamAnswerKey | null>(null);
  const [initialPart3InputMode, setInitialPart3InputMode] =
    useState<Part3InputMode | null>(null);
  const [isContentLocked, setIsContentLocked] = useState(false);
  const [templates, setTemplates] = useState<ExamStructureTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(
    mode === "create",
  );
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(
    null,
  );
  const [templateLoadVersion, setTemplateLoadVersion] = useState(0);
  const [savedStructure, setSavedStructure] =
    useState<ExamStructureSnapshot | null>(null);
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentLoadError, setStudentLoadError] = useState<string | null>(null);
  const [studentLoadVersion, setStudentLoadVersion] = useState(0);
  const [studentSearch, setStudentSearch] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [topicLoadError, setTopicLoadError] = useState<string | null>(null);
  const [topicLoadVersion, setTopicLoadVersion] = useState(0);
  const [pendingTopicCreations, setPendingTopicCreations] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [pendingAnswerKeyCorrection, setPendingAnswerKeyCorrection] =
    useState<ExamEditorOutput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [partThreeTextValidity, setPartThreeTextValidity] = useState(() =>
    Array.from({ length: EXAM_STRUCTURE.partThreeQuestions }, () => true),
  );
  const [dynamicShortAnswerTextValidity, setDynamicShortAnswerTextValidity] =
    useState<Record<string, boolean>>({});
  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExamEditorInput, unknown, ExamEditorOutput>({
    resolver: zodResolver(examEditorSchema),
    defaultValues: createEmptyEditorValues(mode),
  });
  const part3InputMode =
    useWatch({ control, name: "part3InputMode" }) ?? PART3_INPUT_MODE.BUBBLE;
  const visibilityMode =
    useWatch({ control, name: "visibilityMode" }) ??
    EXAM_VISIBILITY_MODE.ALL_STUDENTS;
  const assignedStudentIds =
    useWatch({ control, name: "assignedStudentIds" }) ?? [];
  const structureTemplateId = useWatch({
    control,
    name: "structureTemplateId",
  });
  const selectedTemplate = templates.find(
    (template) => template.id === structureTemplateId,
  );
  const activeStructure =
    mode === "create" ? (selectedTemplate ?? null) : savedStructure;
  const deferredStudentSearch = useDeferredValue(
    studentSearch.trim().toLocaleLowerCase("vi"),
  );
  const filteredStudents = deferredStudentSearch
    ? students.filter((student) =>
        `${student.fullName} @${student.username}`
          .toLocaleLowerCase("vi")
          .includes(deferredStudentSearch),
      )
    : students;
  const hasInvalidPartThreeText =
    part3InputMode === PART3_INPUT_MODE.TEXT &&
    (activeStructure
      ? Object.values(dynamicShortAnswerTextValidity).some(
          (isValid) => !isValid,
        )
      : partThreeTextValidity.some((isValid) => !isValid));
  const structureContainsEssay = Boolean(
    activeStructure?.sections.some((section) =>
      section.questions.some(
        (question) =>
          question.type === EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
      ),
    ),
  );
  const structureTemplateError =
    "structureTemplateId" in errors ? errors.structureTemplateId : undefined;
  const legacyAnswerKeyErrors =
    errors.answerKey && "partOne" in errors.answerKey
      ? errors.answerKey
      : undefined;
  const isBusy =
    isSubmitting || isSaving || pendingTopicCreations > 0 || isLoadingTemplates;

  useEffect(() => {
    if (mode !== "create") {
      return;
    }

    let isCurrent = true;

    void fetchExamStructureTemplates()
      .then((response) => {
        if (isCurrent) {
          setTemplates(response.data.templates);
          setTemplateLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setTemplateLoadError(
            getRequestError(
              error,
              "Không thể tải danh sách mẫu cấu trúc. Vui lòng thử lại.",
            ),
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingTemplates(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [mode, templateLoadVersion]);

  useEffect(() => {
    if (mode === "create") {
      return;
    }

    let isCurrent = true;

    void fetchExam(examId)
      .then((response) => {
        const exam = response.data.exam;

        if (isCurrent) {
          reset(toEditorValues(exam));
          setCurrentPdf(exam.pdf);
          setCurrentUpdatedAt(exam.updatedAt);
          setInitialAnswerKey(exam.answerKey);
          setInitialPart3InputMode(exam.part3InputMode);
          setIsContentLocked(exam.hasAttempts);
          setSavedStructure(exam.structureSnapshot ?? null);
          if (exam.structureSnapshot) {
            setDynamicShortAnswerTextValidity(
              Object.fromEntries(
                exam.structureSnapshot.sections.flatMap((section) =>
                  section.questions
                    .filter(
                      (question) =>
                        question.type ===
                        EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
                    )
                    .map((question) => [question.id, true]),
                ),
              ),
            );
          }
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadError(
            getRequestError(error, "Không thể tải đề thi. Vui lòng thử lại."),
          );
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

  useEffect(() => {
    if (
      visibilityMode !== EXAM_VISIBILITY_MODE.SELECTED_STUDENTS ||
      hasLoadedStudents ||
      studentLoadError
    ) {
      return;
    }

    let isCurrent = true;

    void fetchStudents()
      .then((response) => {
        if (isCurrent) {
          setStudents(response.data.students);
          setIsLoadingStudents(false);
          setHasLoadedStudents(true);
          setStudentLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setIsLoadingStudents(false);
          setStudentLoadError(
            getRequestError(
              error,
              "Không thể tải danh sách học sinh. Vui lòng thử lại.",
            ),
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [hasLoadedStudents, studentLoadError, studentLoadVersion, visibilityMode]);

  useEffect(() => {
    let isCurrent = true;

    void fetchTopics()
      .then((response) => {
        if (isCurrent) {
          setTopics(response.data.topics);
          setIsLoadingTopics(false);
          setTopicLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setIsLoadingTopics(false);
          setTopicLoadError(
            getRequestError(
              error,
              "Không thể tải danh sách chủ đề. Vui lòng thử lại.",
            ),
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [topicLoadVersion]);

  function retryTopicLoad() {
    setIsLoadingTopics(true);
    setTopicLoadError(null);
    setTopicLoadVersion((version) => version + 1);
  }

  function retryTemplateLoad() {
    setIsLoadingTemplates(true);
    setTemplateLoadError(null);
    setTemplateLoadVersion((version) => version + 1);
  }

  function selectStructureTemplate(templateId: string) {
    const template = templates.find((candidate) => candidate.id === templateId);

    setValue("structureTemplateId", templateId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(
      "answerKey",
      template
        ? createEmptyDynamicAnswerKey(template)
        : { answersByQuestionId: {} },
      { shouldDirty: true, shouldValidate: false },
    );
    setDynamicShortAnswerTextValidity(
      template
        ? Object.fromEntries(
            template.sections.flatMap((section) =>
              section.questions
                .filter(
                  (question) =>
                    question.type === EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
                )
                .map((question) => [question.id, true]),
            ),
          )
        : {},
    );
    setSubmissionError(null);
  }

  async function handleCreateTopic(name: string): Promise<Topic> {
    setPendingTopicCreations((count) => count + 1);

    try {
      const response = await createTopicRecord({ name });
      const topic = response.data.topic;

      setTopics((currentTopics) =>
        [
          ...currentTopics.filter((candidate) => candidate.id !== topic.id),
          topic,
        ].sort((first, second) => first.name.localeCompare(second.name, "vi")),
      );

      return topic;
    } finally {
      setPendingTopicCreations((count) => Math.max(0, count - 1));
    }
  }

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

  function setPartThreeTextAnswerValidity(
    questionIndex: number,
    isValid: boolean,
  ) {
    setPartThreeTextValidity((currentValidity) => {
      if (currentValidity[questionIndex] === isValid) {
        return currentValidity;
      }

      return currentValidity.map((currentValue, index) =>
        index === questionIndex ? isValid : currentValue,
      );
    });
  }

  function setDynamicShortAnswerValidity(questionId: string, isValid: boolean) {
    setDynamicShortAnswerTextValidity((currentValidity) => {
      if (currentValidity[questionId] === isValid) {
        return currentValidity;
      }

      return { ...currentValidity, [questionId]: isValid };
    });
  }

  async function saveExam(
    input: ExamEditorOutput,
    confirmAnswerKeyCorrection: boolean,
  ) {
    setIsSaving(true);
    setSubmissionError(null);
    try {
      if (mode === "create" && pdfFile) {
        await createExamRecord(input, pdfFile);
      } else if (mode === "edit" && examId && currentUpdatedAt) {
        const updateInput =
          "structureTemplateId" in input
            ? (({ structureTemplateId, ...editableFields }) => {
                void structureTemplateId;
                return editableFields;
              })(input)
            : input;
        await updateExamRecord(
          examId,
          { ...updateInput, expectedUpdatedAt: currentUpdatedAt },
          pdfFile ?? undefined,
          confirmAnswerKeyCorrection,
        );
      } else {
        throw new Error("Invalid exam form state.");
      }

      router.push("/admin/exams");
      router.refresh();
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.code === "ANSWER_KEY_CORRECTION_CONFIRMATION_REQUIRED"
      ) {
        setIsContentLocked(true);
        setPendingAnswerKeyCorrection(input);
        return;
      }

      const contentBecameLocked =
        error instanceof ApiClientError && error.code === "EXAM_CONTENT_LOCKED";

      if (contentBecameLocked) {
        setIsContentLocked(true);
        setPdfFile(null);
        setPendingAnswerKeyCorrection(null);

        if (initialPart3InputMode) {
          setValue("part3InputMode", initialPart3InputMode, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
      }

      setSubmissionError(getRequestError(error));
      const errorId =
        confirmAnswerKeyCorrection && !contentBecameLocked
          ? "exam-correction-error"
          : "exam-submission-error";
      requestAnimationFrame(() => document.getElementById(errorId)?.focus());
    } finally {
      setIsSaving(false);
    }
  }

  const onSubmit = handleSubmit(
    async (input) => {
      setSubmissionError(null);

      if (structureContainsEssay) {
        setSubmissionError(
          "Mẫu cấu trúc có câu tự luận bằng hình ảnh, hiện chưa thể dùng để tạo đề thi.",
        );
        return;
      }

      if (
        activeStructure &&
        (!isDynamicExamAnswerKey(input.answerKey) ||
          !createDynamicExamAnswerKeySchema(activeStructure).safeParse(
            input.answerKey,
          ).success)
      ) {
        setSubmissionError(
          "Đáp án không khớp với cấu trúc đã chọn. Vui lòng kiểm tra lại.",
        );
        return;
      }

      if (hasInvalidPartThreeText) {
        setSubmissionError(
          "Có đáp án trả lời ngắn chưa hợp lệ. Hãy hoàn thành hoặc xóa nội dung đang nhập.",
        );
        return;
      }

      if (mode === "create" && !pdfFile) {
        setFileError("Vui lòng chọn tệp PDF của đề thi.");
        return;
      }

      if (
        mode === "edit" &&
        isContentLocked &&
        initialAnswerKey &&
        !areExamAnswerKeysEqual(input.answerKey, initialAnswerKey)
      ) {
        setPendingAnswerKeyCorrection(input);
        return;
      }

      await saveExam(input, false);
    },
    () => {
      setSubmissionError(
        "Vui lòng kiểm tra và nhập đầy đủ các trường bắt buộc.",
      );
      requestAnimationFrame(() =>
        document.getElementById("exam-submission-error")?.focus(),
      );
    },
  );

  if (isLoading) {
    return <ExamFormSkeleton />;
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
      <AlertDialog
        open={Boolean(pendingAnswerKeyCorrection)}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setPendingAnswerKeyCorrection(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận sửa đáp án</AlertDialogTitle>
            <AlertDialogDescription>
              Đề thi này đã có lượt làm. Việc sửa đáp án sẽ chấm lại toàn bộ bài
              đã nộp, vì vậy điểm số, kết quả chi tiết và các thống kê hiện tại
              có thể thay đổi. Tệp PDF, câu trả lời của học sinh và trạng thái
              lượt làm sẽ không thay đổi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {submissionError && (
            <p
              id="exam-correction-error"
              tabIndex={-1}
              role="alert"
              className="text-destructive text-sm"
            >
              {submissionError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Quay lại</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving || !pendingAnswerKeyCorrection}
              onClick={() => {
                if (pendingAnswerKeyCorrection) {
                  void saveExam(pendingAnswerKeyCorrection, true);
                }
              }}
            >
              {isSaving ? "Đang chấm lại..." : "Xác nhận sửa và chấm lại"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <fieldset disabled={isBusy} className="contents">
        {activeStructure ? (
          <Controller
            control={control}
            name="answerKey"
            render={({ field, fieldState }) => {
              const answersByQuestionId =
                "answersByQuestionId" in field.value
                  ? field.value.answersByQuestionId
                  : {};
              const updateAnswer = (
                questionId: string,
                answer: DynamicEditorAnswer,
              ) => {
                field.onChange({
                  answersByQuestionId: {
                    ...answersByQuestionId,
                    [questionId]: answer,
                  },
                });
              };

              return (
                <div className="space-y-6">
                  {activeStructure.sections.map((section) => (
                    <section
                      key={section.id}
                      className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm"
                    >
                      <div>
                        <h2 className="text-xl font-semibold">
                          {section.title}
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Nhập đáp án theo đúng thứ tự câu hỏi trong tệp PDF.
                        </p>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        {section.questions.map((question, questionIndex) => {
                          const answer = answersByQuestionId[question.id];
                          const questionLabel = `Câu ${questionIndex + 1}`;
                          const scoreLabel = `${(
                            question.maxScoreHundredths / 100
                          ).toLocaleString("vi-VN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} điểm`;

                          if (
                            question.type ===
                            EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE
                          ) {
                            return (
                              <div
                                key={question.id}
                                className="border-border space-y-2 rounded-lg border p-4"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <Label htmlFor={`dynamic-${question.id}`}>
                                    {questionLabel}
                                  </Label>
                                  <span className="text-muted-foreground text-xs">
                                    {scoreLabel}
                                  </span>
                                </div>
                                <select
                                  id={`dynamic-${question.id}`}
                                  className={selectClassName}
                                  value={
                                    typeof answer === "string" ? answer : ""
                                  }
                                  onBlur={field.onBlur}
                                  onChange={(event) =>
                                    updateAnswer(
                                      question.id,
                                      event.target.value as PartOneAnswer | "",
                                    )
                                  }
                                >
                                  <option value="">Chọn đáp án</option>
                                  {PART_ONE_CHOICES.map((choice) => (
                                    <option key={choice} value={choice}>
                                      {choice}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          }

                          if (
                            question.type ===
                            EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE
                          ) {
                            const statementAnswers =
                              answer &&
                              typeof answer === "object" &&
                              !Array.isArray(answer)
                                ? answer
                                : { a: null, b: null, c: null, d: null };

                            return (
                              <fieldset
                                key={question.id}
                                className="border-border space-y-3 rounded-lg border p-4"
                              >
                                <legend className="px-1 font-medium">
                                  {questionLabel} · {scoreLabel}
                                </legend>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                  {PART_TWO_STATEMENTS.map((statement) => (
                                    <div key={statement} className="space-y-2">
                                      <Label
                                        htmlFor={`dynamic-${question.id}-${statement}`}
                                      >
                                        Ý {statement}
                                      </Label>
                                      <select
                                        id={`dynamic-${question.id}-${statement}`}
                                        className={selectClassName}
                                        value={
                                          statementAnswers[statement] === null
                                            ? ""
                                            : statementAnswers[statement]
                                              ? "true"
                                              : "false"
                                        }
                                        onBlur={field.onBlur}
                                        onChange={(event) =>
                                          updateAnswer(question.id, {
                                            ...statementAnswers,
                                            [statement]:
                                              event.target.value === ""
                                                ? null
                                                : event.target.value === "true",
                                          })
                                        }
                                      >
                                        <option value="">Chọn</option>
                                        <option value="true">Đúng</option>
                                        <option value="false">Sai</option>
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </fieldset>
                            );
                          }

                          if (
                            question.type ===
                            EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER
                          ) {
                            const shortAnswer = Array.isArray(answer)
                              ? answer
                              : createEmptyShortAnswerSlots();

                            return (
                              <div
                                key={question.id}
                                className="border-border rounded-lg border p-4"
                              >
                                {part3InputMode === PART3_INPUT_MODE.BUBBLE ? (
                                  <ShortAnswerBubbleInput
                                    value={shortAnswer}
                                    onChange={(value) =>
                                      updateAnswer(question.id, value)
                                    }
                                    label={`${questionLabel} · ${scoreLabel}`}
                                    disabled={isBusy}
                                    onBlur={field.onBlur}
                                  />
                                ) : (
                                  <ShortAnswerTextInput
                                    value={shortAnswer}
                                    onChange={(value) =>
                                      updateAnswer(question.id, value)
                                    }
                                    label={`${questionLabel} · ${scoreLabel}`}
                                    disabled={isBusy}
                                    onBlur={field.onBlur}
                                    onValidityChange={(isValid) =>
                                      setDynamicShortAnswerValidity(
                                        question.id,
                                        isValid,
                                      )
                                    }
                                  />
                                )}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={question.id}
                              className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm"
                            >
                              {questionLabel}: câu tự luận bằng hình ảnh chưa
                              được hỗ trợ.
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                  {fieldState.invalid && (
                    <p role="alert" className="text-destructive text-sm">
                      Vui lòng nhập đầy đủ đáp án hợp lệ cho mọi câu hỏi.
                    </p>
                  )}
                </div>
              );
            }}
          />
        ) : mode === "create" ? (
          <section className="border-border bg-muted/20 rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">Chưa chọn mẫu cấu trúc</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Chọn mẫu ở phần thông tin đề thi để nhập đáp án.
            </p>
          </section>
        ) : null}
        <section className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Thông tin đề thi</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {activeStructure
                ? `${activeStructure.sections.reduce((total, section) => total + section.questions.length, 0)} câu theo mẫu cấu trúc, thời gian ${EXAM_STRUCTURE.durationMinutes} phút.`
                : mode === "create"
                  ? "Chọn mẫu cấu trúc trước khi nhập đáp án."
                  : `Cấu trúc cố định: ${EXAM_STRUCTURE.totalQuestions} câu, thời gian ${EXAM_STRUCTURE.durationMinutes} phút.`}
            </p>
            {isContentLocked && (
              <p className="mt-2 text-sm font-medium text-amber-700">
                Đề thi đã có lượt làm. Bạn vẫn có thể sửa thông tin và thiết lập
                chung hoặc hiệu chỉnh đáp án; tệp PDF và cách nhập Phần III đã
                được khóa. Sửa đáp án sẽ yêu cầu xác nhận và chấm lại các bài đã
                nộp.
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

            {mode === "create" ? (
              <div className="space-y-3 md:col-span-2">
                <div className="space-y-2">
                  <Label htmlFor="exam-structure-template">Mẫu cấu trúc</Label>
                  <select
                    id="exam-structure-template"
                    className={selectClassName}
                    value={
                      typeof structureTemplateId === "string"
                        ? structureTemplateId
                        : ""
                    }
                    required
                    aria-invalid={Boolean(structureTemplateError)}
                    aria-describedby={
                      structureTemplateError
                        ? "exam-structure-template-error"
                        : "exam-structure-template-help"
                    }
                    onChange={(event) =>
                      selectStructureTemplate(event.target.value)
                    }
                  >
                    <option value="">Chọn mẫu cấu trúc</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.isBuiltIn ? " (mặc định)" : ""}
                      </option>
                    ))}
                  </select>
                  <p
                    id="exam-structure-template-help"
                    className="text-muted-foreground text-xs"
                  >
                    Cấu trúc sẽ được sao chép vào đề thi và không thay đổi khi
                    mẫu được chỉnh sửa sau này.
                  </p>
                  {structureTemplateError && (
                    <p
                      id="exam-structure-template-error"
                      role="alert"
                      className="text-destructive text-sm"
                    >
                      {structureTemplateError.message}
                    </p>
                  )}
                </div>
                {templateLoadError && (
                  <div className="space-y-2">
                    <p role="alert" className="text-destructive text-sm">
                      {templateLoadError}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={retryTemplateLoad}
                    >
                      Thử tải lại
                    </Button>
                  </div>
                )}
              </div>
            ) : savedStructure ? (
              <div className="border-border bg-muted/30 space-y-1 rounded-lg border p-3 text-sm md:col-span-2">
                <p className="font-medium">Cấu trúc đã lưu cùng đề thi</p>
                <p className="text-muted-foreground">
                  Không thể đổi mẫu hoặc cấu trúc sau khi tạo đề thi.
                </p>
              </div>
            ) : null}

            {activeStructure && (
              <div className="border-border grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2 md:col-span-2 lg:grid-cols-3">
                {activeStructure.sections.map((section) => (
                  <div key={section.id}>
                    <p className="font-medium">{section.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {section.questions.length} câu ·{" "}
                      {(
                        section.questions.reduce(
                          (total, question) =>
                            total + question.maxScoreHundredths,
                          0,
                        ) / 100
                      ).toLocaleString("vi-VN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      điểm
                    </p>
                  </div>
                ))}
              </div>
            )}

            {structureContainsEssay && (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm md:col-span-2"
              >
                Mẫu này có câu tự luận bằng hình ảnh. Tính năng tạo và làm loại
                câu hỏi này hiện chưa được hỗ trợ.
              </p>
            )}

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
          <fieldset className="max-w-2xl space-y-3">
            <legend className="text-sm font-medium">Phạm vi học sinh</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="border-border flex items-center gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  value={EXAM_VISIBILITY_MODE.ALL_STUDENTS}
                  {...register("visibilityMode")}
                />
                <span>Tất cả học sinh</span>
              </label>
              <label className="border-border flex items-center gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  value={EXAM_VISIBILITY_MODE.SELECTED_STUDENTS}
                  {...register("visibilityMode")}
                />
                <span>Học sinh được chọn</span>
              </label>
            </div>

            {visibilityMode === EXAM_VISIBILITY_MODE.SELECTED_STUDENTS && (
              <div className="border-border space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium" aria-live="polite">
                    {assignedStudentIds.length} học sinh đã chọn
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Hiển thị họ tên và @tên đăng nhập
                  </p>
                </div>
                {isLoadingStudents ? (
                  <p role="status" className="text-muted-foreground text-sm">
                    Đang tải danh sách học sinh...
                  </p>
                ) : studentLoadError ? (
                  <div className="space-y-2">
                    <p role="alert" className="text-destructive text-sm">
                      {studentLoadError}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsLoadingStudents(true);
                        setStudentLoadError(null);
                        setStudentLoadVersion((version) => version + 1);
                      }}
                    >
                      Thử lại
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      type="search"
                      value={studentSearch}
                      placeholder="Tìm theo họ tên hoặc tên đăng nhập"
                      aria-label="Tìm học sinh để phân công"
                      onChange={(event) => setStudentSearch(event.target.value)}
                    />
                    <Controller
                      control={control}
                      name="assignedStudentIds"
                      render={({ field }) => (
                        <div className="border-border max-h-56 overflow-y-auto rounded-md border">
                          {filteredStudents.map((student, index) => (
                            <label
                              key={student.id}
                              className="border-border flex items-start gap-3 border-b px-3 py-2.5 text-sm last:border-b-0"
                            >
                              <input
                                ref={index === 0 ? field.ref : undefined}
                                type="checkbox"
                                name={field.name}
                                value={student.id}
                                checked={(field.value ?? []).includes(
                                  student.id,
                                )}
                                className="mt-0.5 size-4"
                                onBlur={field.onBlur}
                                onChange={(event) => {
                                  const selectedIds = field.value ?? [];
                                  field.onChange(
                                    event.target.checked
                                      ? [...selectedIds, student.id]
                                      : selectedIds.filter(
                                          (studentId) =>
                                            studentId !== student.id,
                                        ),
                                  );
                                }}
                              />
                              <span className="min-w-0">
                                <span className="block font-medium">
                                  {student.fullName}
                                </span>
                                <span className="text-muted-foreground block text-xs">
                                  @{student.username}
                                  {!student.isActive && " · Đã khóa"}
                                </span>
                              </span>
                            </label>
                          ))}
                          {filteredStudents.length === 0 && (
                            <p className="text-muted-foreground px-3 py-5 text-center text-sm">
                              {students.length === 0
                                ? "Chưa có tài khoản học sinh."
                                : "Không tìm thấy học sinh phù hợp."}
                            </p>
                          )}
                        </div>
                      )}
                    />
                  </>
                )}
              </div>
            )}
          </fieldset>
          <div className="max-w-md space-y-2">
            <Label htmlFor="part-three-input-mode">
              {activeStructure
                ? "Cách nhập câu trả lời ngắn"
                : "Cách nhập đáp án Phần III"}
            </Label>
            <Controller
              control={control}
              name="part3InputMode"
              render={({ field }) => (
                <select
                  ref={field.ref}
                  id="part-three-input-mode"
                  name={field.name}
                  className={selectClassName}
                  value={field.value}
                  disabled={isContentLocked}
                  aria-describedby="part-three-input-mode-help"
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                    setPartThreeTextValidity(
                      Array.from(
                        { length: EXAM_STRUCTURE.partThreeQuestions },
                        () => true,
                      ),
                    );
                    setDynamicShortAnswerTextValidity((currentValidity) =>
                      Object.fromEntries(
                        Object.keys(currentValidity).map((questionId) => [
                          questionId,
                          true,
                        ]),
                      ),
                    );
                  }}
                >
                  {PART3_INPUT_MODES.map((inputMode) => (
                    <option key={inputMode} value={inputMode}>
                      {part3InputModeLabels[inputMode]}
                    </option>
                  ))}
                </select>
              )}
            />
            <p
              id="part-three-input-mode-help"
              className="text-muted-foreground text-xs leading-5"
            >
              {isContentLocked
                ? "Không thể đổi cách nhập sau khi đề đã có lượt làm."
                : "Hai cách nhập dùng cùng quy tắc 4 ô và cùng cách chấm điểm."}
            </p>
          </div>
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

        {!activeStructure && mode === "edit" && (
          <>
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
                      legacyAnswerKeyErrors?.partOne?.[questionIndex]?.message;
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
                        <Controller
                          control={control}
                          name={
                            `questionTopicIds.partOne.${questionIndex}` as const
                          }
                          render={({ field }) => (
                            <QuestionTopicSelector
                              label="Chủ đề kiến thức"
                              topics={topics}
                              value={field.value ?? []}
                              disabled={isBusy}
                              isLoading={isLoadingTopics}
                              loadError={topicLoadError}
                              onChange={field.onChange}
                              onCreateTopic={handleCreateTopic}
                              onRetry={retryTopicLoad}
                            />
                          )}
                        />
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
                    >
                      <legend className="px-1 font-medium">
                        Câu {questionIndex + 1}
                      </legend>
                      <div className="mb-4 mt-2 max-w-sm">
                        <Controller
                          control={control}
                          name={
                            `questionTopicIds.partTwo.${questionIndex}` as const
                          }
                          render={({ field }) => (
                            <QuestionTopicSelector
                              label="Chủ đề của toàn bộ câu a/b/c/d"
                              topics={topics}
                              value={field.value ?? []}
                              disabled={isBusy}
                              isLoading={isLoadingTopics}
                              loadError={topicLoadError}
                              onChange={field.onChange}
                              onCreateTopic={handleCreateTopic}
                              onRetry={retryTopicLoad}
                            />
                          )}
                        />
                      </div>
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
                <h2 className="text-xl font-semibold">
                  Phần III - Trả lời ngắn
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {part3InputMode === PART3_INPUT_MODE.BUBBLE
                    ? "Tô tối đa 4 ô ký tự. Dấu phẩy hiển thị theo mẫu Việt Nam và được lưu nội bộ bằng dấu chấm."
                    : "Nhập tối đa 4 ký tự bằng chữ số, dấu âm và dấu phẩy thập phân."}
                </p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {Array.from(
                  { length: EXAM_STRUCTURE.partThreeQuestions },
                  (_, questionIndex) => (
                    <div key={questionIndex} className="space-y-2">
                      <Controller
                        control={control}
                        name={`answerKey.partThree.${questionIndex}` as const}
                        render={({ field, fieldState }) =>
                          part3InputMode === PART3_INPUT_MODE.BUBBLE ? (
                            <ShortAnswerBubbleInput
                              value={field.value}
                              onChange={field.onChange}
                              label={`Câu ${questionIndex + 1}`}
                              error={fieldState.error?.message}
                              disabled={isBusy}
                              inputRef={field.ref}
                              onBlur={field.onBlur}
                            />
                          ) : (
                            <ShortAnswerTextInput
                              value={field.value}
                              onChange={field.onChange}
                              label={`Câu ${questionIndex + 1}`}
                              error={fieldState.error?.message}
                              disabled={isBusy}
                              inputRef={field.ref}
                              onBlur={field.onBlur}
                              onValidityChange={(isValid) =>
                                setPartThreeTextAnswerValidity(
                                  questionIndex,
                                  isValid,
                                )
                              }
                            />
                          )
                        }
                      />
                      <Controller
                        control={control}
                        name={
                          `questionTopicIds.partThree.${questionIndex}` as const
                        }
                        render={({ field }) => (
                          <QuestionTopicSelector
                            label="Chủ đề kiến thức"
                            topics={topics}
                            value={field.value ?? []}
                            disabled={isBusy}
                            isLoading={isLoadingTopics}
                            loadError={topicLoadError}
                            onChange={field.onChange}
                            onCreateTopic={handleCreateTopic}
                            onRetry={retryTopicLoad}
                          />
                        )}
                      />
                    </div>
                  ),
                )}
              </div>
            </section>
          </>
        )}
      </fieldset>

      {submissionError && !pendingAnswerKeyCorrection && (
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
        {isBusy ? (
          <Button type="button" variant="outline" disabled>
            Hủy
          </Button>
        ) : (
          <Button asChild type="button" variant="outline">
            <Link href="/admin/exams">Hủy</Link>
          </Button>
        )}
        <Button type="submit" disabled={isBusy || structureContainsEssay}>
          {isBusy
            ? "Đang lưu đề thi..."
            : mode === "create"
              ? "Tạo đề thi"
              : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
