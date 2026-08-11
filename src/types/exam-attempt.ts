import type {
  EXAM_ATTEMPT_STATUS,
  STUDENT_EXAM_STATE,
} from "@/lib/constants/exam-attempt";
import type {
  PartOneAnswer,
  PartTwoAnswer,
  ShortAnswerSlots,
} from "@/types/exam";

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

export interface AttemptAnswerProgress {
  answeredQuestions: number;
  totalQuestions: number;
  partOne: boolean[];
  partTwo: boolean[];
  partThree: boolean[];
}

export interface AttemptGradingSnapshot {
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

export interface ExamAttempt {
  id: string;
  examId: string;
  attemptNumber: number;
  status: ExamAttemptStatus;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  lastSavedAt?: string;
  answers: AttemptAnswers;
}

export interface StudentExamSummary {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  allowRetake: boolean;
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
    sections: {
      partOne: number;
      partTwo: number;
      partThree: number;
    };
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
}

export interface StudentPartTwoStatementReview {
  studentAnswer: boolean | null;
  correctAnswer: boolean;
  isCorrect: boolean;
}
