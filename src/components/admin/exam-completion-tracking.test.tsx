// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAdminExamAssignmentCompletion: vi.fn(),
}));

vi.mock("@/lib/api/reporting", () => ({
  fetchAdminExamAssignmentCompletion: mocks.fetchAdminExamAssignmentCompletion,
}));

import { ExamCompletionTracking } from "@/components/admin/exam-completion-tracking";

describe("Exam completion tracking", () => {
  afterEach(() => {
    cleanup();
    mocks.fetchAdminExamAssignmentCompletion.mockReset();
  });

  it("renders consistent student totals and completion classifications", async () => {
    mocks.fetchAdminExamAssignmentCompletion.mockResolvedValue({
      data: {
        report: {
          exam: {
            id: "exam-id",
            title: "Exam",
            status: "PUBLISHED",
            assignmentDueAt: "2026-11-12T02:00:00.000Z",
          },
          totals: {
            assigned: 3,
            completed: 1,
            inProgress: 1,
            notStarted: 1,
            overdue: 2,
          },
          students: [
            {
              student: {
                id: "student-id",
                username: "student",
                fullName: "Hoc Sinh",
                isActive: false,
              },
              completionStatus: "COMPLETED",
              isOverdue: false,
              firstCompletion: {
                attemptId: "attempt-id",
                attemptNumber: 2,
                status: "AUTO_SUBMITTED",
                submittedAt: "2026-11-12T02:01:00.000Z",
                timeliness: "LATE",
              },
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 3,
            totalPages: 1,
          },
        },
      },
    });

    render(<ExamCompletionTracking examId="exam-id" />);

    expect(await screen.findByText("Hoc Sinh")).toBeTruthy();
    expect(screen.getByText(/Đã vô hiệu hóa/)).toBeTruthy();
    expect(screen.getByText("Trễ hạn")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Xem lượt 2" }).getAttribute("href"),
    ).toBe("/admin/results/attempt-id");
    expect(mocks.fetchAdminExamAssignmentCompletion).toHaveBeenCalledWith(
      "exam-id",
      1,
      20,
    );
  });
});
