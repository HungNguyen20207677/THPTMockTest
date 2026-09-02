import type {
  ExamAttemptStatus,
  StudentExamAttemptResult,
} from "@/types/exam-attempt";
import type { ExamStatus } from "@/types/exam";
import type { StudentAccount } from "@/types/user";

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ReportingStudentIdentity {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
}

export interface ReportingExamIdentity {
  id: string;
  title: string;
  status: ExamStatus;
}

export interface AttemptScoreSummary {
  total: number;
  sections: {
    partOne: number;
    partTwo: number;
    partThree: number;
  };
}

export interface ScoreStatistics {
  average: number | null;
  highest: number | null;
  lowest: number | null;
}

export interface PerformanceStatistics extends ScoreStatistics {
  completedAttemptCount: number;
  first: number | null;
  latest: number | null;
  best: number | null;
  improvement: number | null;
}

export interface AdminDashboardSummary {
  activeStudentCount: number;
  examCount: number;
  publishedExamCount: number;
  activeAttemptCount: number;
  completedAttemptCount: number;
}

export interface AdminResultSummary {
  id: string;
  student: ReportingStudentIdentity | null;
  exam: ReportingExamIdentity | null;
  attemptNumber: number;
  status: ExamAttemptStatus;
  startedAt: string;
  expiresAt: string;
  submittedAt: string;
  timeUsedSeconds: number;
  score: AttemptScoreSummary;
}

export interface AdminResultList {
  results: AdminResultSummary[];
  pagination: PaginationMetadata;
}

export interface AdminAttemptDetail {
  student: ReportingStudentIdentity | null;
  exam: ReportingExamIdentity | null;
  attempt: {
    id: string;
    attemptNumber: number;
    status: ExamAttemptStatus;
    startedAt: string;
    expiresAt: string;
    submittedAt?: string;
    timeUsedSeconds?: number;
  };
  score?: AttemptScoreSummary;
  answerReview?: StudentExamAttemptResult["answerReview"];
}

export interface AdminStudentExamPerformance {
  exam: ReportingExamIdentity | null;
  activeAttemptCount: number;
  statistics: PerformanceStatistics;
}

export interface AdminStudentStatistics {
  completedAttemptCount: number;
  average: number | null;
  best: number | null;
  latest: number | null;
}

export interface AdminStudentTopicStatistics {
  topicId: string;
  topicName: string;
  observationCount: number;
  averagePerformancePercent: number;
}

export interface AdminStudentDetail {
  student: StudentAccount;
  activeAttemptCount: number;
  distinctExamCount: number;
  statistics: AdminStudentStatistics;
  topicStatistics: AdminStudentTopicStatistics[];
  exams: AdminStudentExamPerformance[];
}

export interface AdminExamStudentPerformance {
  student: ReportingStudentIdentity | null;
  statistics: PerformanceStatistics;
}

export interface AdminExamQuestionCorrectnessStatistics {
  questionNumber: number;
  completedAttemptCount: number;
  correctCount: number;
  incorrectCount: number;
  correctRatePercent: number | null;
}

export interface AdminExamPartTwoStatementStatistics {
  correctCount: number;
  correctRatePercent: number | null;
}

export interface AdminExamPartTwoQuestionStatistics {
  questionNumber: number;
  completedAttemptCount: number;
  fullCorrectCount: number;
  fullCorrectRatePercent: number | null;
  averageScoreHundredths: number | null;
  statements: {
    a: AdminExamPartTwoStatementStatistics;
    b: AdminExamPartTwoStatementStatistics;
    c: AdminExamPartTwoStatementStatistics;
    d: AdminExamPartTwoStatementStatistics;
  };
}

export interface AdminExamQuestionStatistics {
  partOne: AdminExamQuestionCorrectnessStatistics[];
  partTwo: AdminExamPartTwoQuestionStatistics[];
  partThree: AdminExamQuestionCorrectnessStatistics[];
}

export interface AdminExamTopicStatistics {
  topicId: string;
  topicName: string;
  taggedQuestionCount: number;
  observationCount: number;
  averagePerformancePercent: number | null;
}

export interface AdminExamResults {
  exam: ReportingExamIdentity;
  activeAttemptCount: number;
  completedAttemptCount: number;
  distinctStudentCount: number;
  submittedAttemptCount: number;
  autoSubmittedAttemptCount: number;
  statistics: ScoreStatistics;
  questionStatistics: AdminExamQuestionStatistics;
  topicStatistics: AdminExamTopicStatistics[];
  students: AdminExamStudentPerformance[];
}

export interface StudentExamAttemptHistoryItem {
  id: string;
  attemptNumber: number;
  status: ExamAttemptStatus;
  startedAt: string;
  submittedAt: string;
  timeUsedSeconds: number;
  score?: number;
}

export interface StudentExamAttemptHistory {
  exam: {
    id: string;
    title: string;
  };
  visibility: {
    score: boolean;
    answers: boolean;
  };
  attempts: StudentExamAttemptHistoryItem[];
  pagination: PaginationMetadata;
}
