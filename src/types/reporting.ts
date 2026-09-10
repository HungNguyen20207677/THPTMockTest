import type {
  ExamAttemptGradingStatus,
  ExamAttemptStatus,
  StudentExamAttemptResult,
} from "@/types/exam-attempt";
import type { ExamStatus } from "@/types/exam";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";
import type { ExamStructureQuestionType } from "@/types/exam-structure-template";
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
  sections?: {
    partOne: number;
    partTwo: number;
    partThree: number;
  };
  sectionsById?: Record<string, number>;
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
  gradingStatus: ExamAttemptGradingStatus;
  score?: AttemptScoreSummary;
  objectiveScore?: StudentExamAttemptResult["objectiveScore"];
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
  gradingStatus?: ExamAttemptGradingStatus;
  score?: AttemptScoreSummary;
  objectiveScore?: StudentExamAttemptResult["objectiveScore"];
  answerReview?: StudentExamAttemptResult["answerReview"];
  structureSnapshot?: ExamStructureSnapshot;
  dynamicAnswerReview?: StudentExamAttemptResult["dynamicAnswerReview"];
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

interface AdminExamDynamicQuestionIdentity {
  sectionId: string;
  sectionTitle: string;
  questionId: string;
  questionNumber: number;
  questionType: ExamStructureQuestionType;
}

export interface AdminExamDynamicQuestionCorrectnessStatistics extends AdminExamDynamicQuestionIdentity {
  completedAttemptCount: number;
  correctCount: number;
  incorrectCount: number;
  correctRatePercent: number | null;
}

export interface AdminExamDynamicTrueFalseQuestionStatistics extends AdminExamDynamicQuestionIdentity {
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

export type AdminExamDynamicQuestionStatisticsItem =
  | AdminExamDynamicQuestionCorrectnessStatistics
  | AdminExamDynamicTrueFalseQuestionStatistics;

export interface AdminExamDynamicQuestionStatistics {
  sections: Array<{
    sectionId: string;
    sectionTitle: string;
    questions: AdminExamDynamicQuestionStatisticsItem[];
  }>;
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
  dynamicQuestionStatistics?: AdminExamDynamicQuestionStatistics;
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
  gradingStatus: ExamAttemptGradingStatus;
  score?: number;
  objectiveScore?: StudentExamAttemptResult["objectiveScore"];
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
