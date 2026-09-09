import type {
  EXAM_ATTEMPT_STATUS,
  STUDENT_EXAM_STATE,
} from "@/lib/constants/exam-attempt";
import type {
  Part3InputMode,
  PartOneAnswer,
  PartTwoAnswer,
  ShortAnswerSlots,
} from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";

export type ExamAttemptStatus =
  (typeof EXAM_ATTEMPT_STATUS)[keyof typeof EXAM_ATTEMPT_STATUS];
export type StudentExamState =
  (typeof STUDENT_EXAM_STATE)[keyof typeof STUDENT_EXAM_STATE];

export interface AttemptPartTwoAnswer {
  a: boolean | null;
  b: boolean | null;
  c: boolean | null;
  d: boolean | null;
}

export interface AttemptAnswers {
  partOne: Array<PartOneAnswer | null>;
  partTwo: AttemptPartTwoAnswer[];
  partThree: ShortAnswerSlots[];
}

export type DynamicAttemptAnswer =
  PartOneAnswer | null | AttemptPartTwoAnswer | ShortAnswerSlots;

export interface DynamicAttemptAnswers {
  answersByQuestionId: Record<string, DynamicAttemptAnswer>;
}

export type ExamAttemptAnswers = AttemptAnswers | DynamicAttemptAnswers;

export interface AttemptAnswerProgress {
  answeredQuestions: number;
  totalQuestions: number;
  partOne: boolean[];
  partTwo: boolean[];
  partThree: boolean[];
}

export interface DynamicAttemptAnswerProgress {
  answeredQuestions: number;
  totalQuestions: number;
  byQuestionId: Record<string, boolean>;
}

export interface AttemptGradingSnapshot {
  answerKeyRevision: number;
  totalScoreHundredths: number;
  sectionScoresHundredths: {
    partOne: number;
    partTwo: number;
    partThree: number;
  };
  partOne: Array<{
    isCorrect: boolean;
  }>;
  partTwo: Array<{
    correctStatementCount: number;
    scoreHundredths: number;
    statements: PartTwoAnswer;
  }>;
  partThree: Array<{
    isCorrect: boolean;
  }>;
}

export interface DynamicQuestionCorrectnessResult {
  isCorrect: boolean;
  scoreHundredths: number;
}

export interface DynamicTrueFalseQuestionResult {
  correctStatementCount: number;
  scoreHundredths: number;
  statements: PartTwoAnswer;
}

export type DynamicQuestionGradingResult =
  DynamicQuestionCorrectnessResult | DynamicTrueFalseQuestionResult;

export interface DynamicAttemptGradingSnapshot {
  answerKeyRevision: number;
  totalScoreHundredths: number;
  sectionScoresHundredths: Record<string, number>;
  questionsById: Record<string, DynamicQuestionGradingResult>;
}

export type ExamAttemptGradingSnapshot =
  AttemptGradingSnapshot | DynamicAttemptGradingSnapshot;

export interface ExamAttempt {
  id: string;
  examId: string;
  attemptNumber: number;
  status: ExamAttemptStatus;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  lastSavedAt?: string;
  answers: ExamAttemptAnswers;
}

export interface StudentExamSummary {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  allowRetake: boolean;
  isAvailable: boolean;
  state: StudentExamState;
  activeAttemptId?: string;
  latestCompletedAttemptId?: string;
  completedAttemptCount: number;
  createdAt: string;
}

export interface StudentExamList {
  exams: StudentExamSummary[];
  serverTime: string;
}

export interface StudentExamAttemptContext {
  exam: {
    id: string;
    title: string;
    description?: string;
    pdf: {
      url: string;
      filename: string;
    };
    durationMinutes: number;
    part3InputMode: Part3InputMode;
    shortAnswerInputMode?: Part3InputMode;
    structureSnapshot?: ExamStructureSnapshot;
  };
  attempt: ExamAttempt;
  serverNow: string;
  canEditAnswers: boolean;
}

export interface StudentExamAttemptMutationResult {
  attempt: ExamAttempt;
  serverNow: string;
  canEditAnswers: boolean;
}

export interface StudentExamAttemptResult {
  exam: {
    id: string;
    title: string;
    structureSnapshot?: ExamStructureSnapshot;
  };
  attempt: {
    id: string;
    attemptNumber: number;
    status: ExamAttemptStatus;
    startedAt: string;
    expiresAt: string;
    submittedAt: string;
    timeUsedSeconds: number;
  };
  visibility: {
    score: boolean;
    answers: boolean;
  };
  score?: {
    total: number;
    sections?: {
      partOne: number;
      partTwo: number;
      partThree: number;
    };
    sectionsById?: Record<string, number>;
  };
  answerReview?: {
    partOne: Array<{
      studentAnswer: PartOneAnswer | null;
      correctAnswer: PartOneAnswer;
      isCorrect: boolean;
    }>;
    partTwo: Array<{
      studentAnswer: AttemptPartTwoAnswer;
      correctAnswer: PartTwoAnswer;
      correctStatementCount: number;
      statements: {
        a: StudentPartTwoStatementReview;
        b: StudentPartTwoStatementReview;
        c: StudentPartTwoStatementReview;
        d: StudentPartTwoStatementReview;
      };
      score?: number;
    }>;
    partThree: Array<{
      studentAnswer: ShortAnswerSlots;
      studentDisplayAnswer: string | null;
      correctDisplayAnswer: string;
      isCorrect: boolean;
    }>;
  };
  dynamicAnswerReview?: {
    questionsById: Record<string, DynamicQuestionAnswerReview>;
  };
}

export interface DynamicSingleChoiceAnswerReview {
  type: "SINGLE_CHOICE";
  studentAnswer: PartOneAnswer | null;
  correctAnswer: PartOneAnswer;
  isCorrect: boolean;
}

export interface DynamicTrueFalseAnswerReview {
  type: "TRUE_FALSE";
  studentAnswer: AttemptPartTwoAnswer;
  correctAnswer: PartTwoAnswer;
  correctStatementCount: number;
  statements: {
    a: StudentPartTwoStatementReview;
    b: StudentPartTwoStatementReview;
    c: StudentPartTwoStatementReview;
    d: StudentPartTwoStatementReview;
  };
  score?: number;
}

export interface DynamicShortAnswerReview {
  type: "SHORT_ANSWER";
  studentAnswer: ShortAnswerSlots;
  studentDisplayAnswer: string | null;
  correctDisplayAnswer: string;
  isCorrect: boolean;
}

export type DynamicQuestionAnswerReview =
  | DynamicSingleChoiceAnswerReview
  | DynamicTrueFalseAnswerReview
  | DynamicShortAnswerReview;

export interface StudentPartTwoStatementReview {
  studentAnswer: boolean | null;
  correctAnswer: boolean;
  isCorrect: boolean;
}
