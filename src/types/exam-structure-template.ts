import type { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";

export type ExamStructureQuestionType =
  (typeof EXAM_STRUCTURE_QUESTION_TYPE)[keyof typeof EXAM_STRUCTURE_QUESTION_TYPE];

export interface ExamStructureQuestion {
  id: string;
  type: ExamStructureQuestionType;
  maxScoreHundredths: number;
}

export interface ExamStructureSection {
  id: string;
  title: string;
  questions: ExamStructureQuestion[];
}

export interface ExamStructureSnapshot {
  sections: ExamStructureSection[];
}

export interface ExamStructureTemplate extends ExamStructureSnapshot {
  id: string;
  name: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}
