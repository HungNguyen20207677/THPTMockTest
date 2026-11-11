// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchStudentExams: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/api/student-exams", () => ({
  fetchStudentExams: mocks.fetchStudentExams,
  startStudentExamAttempt: vi.fn(),
}));

vi.mock("@/lib/fullscreen", () => ({
  exitDocumentFullscreen: vi.fn(),
  isDocumentElementFullscreen: vi.fn(() => false),
  requestDocumentFullscreen: vi.fn(),
}));

import { StudentExamList } from "@/components/student/exam-list";
import { STUDENT_EXAM_STATE } from "@/lib/constants/exam-attempt";
import type { StudentExamSummary } from "@/types/exam-attempt";

function createCompletedExam(
  overrides: Partial<StudentExamSummary> = {},
): StudentExamSummary {
  return {
    id: "exam-id",
    title: "Đề giới hạn lượt",
    durationMinutes: 90,
    allowRetake: true,
    maxAttempts: 2,
    attemptCount: 2,
    canStartNewAttempt: false,
    isAvailable: true,
    state: STUDENT_EXAM_STATE.COMPLETED,
    latestCompletedAttemptId: "attempt-id",
    completedAttemptCount: 2,
    createdAt: "2026-11-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("Student Exam list attempt limits", () => {
  afterEach(() => {
    cleanup();
    mocks.fetchStudentExams.mockReset();
    mocks.push.mockReset();
  });

  it("shows an exhausted finite limit without offering another attempt", async () => {
    mocks.fetchStudentExams.mockResolvedValue({
      data: {
        exams: [createCompletedExam()],
        serverTime: "2026-11-11T01:00:00.000Z",
      },
    });

    render(<StudentExamList />);

    await waitFor(() =>
      expect(screen.getByText("Đề giới hạn lượt")).toBeTruthy(),
    );
    expect(screen.getByText(/2\/2 lượt đã dùng/)).toBeTruthy();
    expect(screen.getByText("Đã dùng hết lượt làm")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Làm lại" })).toBeNull();
  });

  it("offers a retake while a finite slot remains", async () => {
    mocks.fetchStudentExams.mockResolvedValue({
      data: {
        exams: [
          createCompletedExam({
            attemptCount: 1,
            completedAttemptCount: 1,
            canStartNewAttempt: true,
          }),
        ],
        serverTime: "2026-11-11T01:00:00.000Z",
      },
    });

    render(<StudentExamList />);

    await waitFor(() =>
      expect(screen.getByText("Có thể làm lại")).toBeTruthy(),
    );
    expect(screen.getByText(/1\/2 lượt đã dùng/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Làm lại" })).toBeTruthy();
  });
});
