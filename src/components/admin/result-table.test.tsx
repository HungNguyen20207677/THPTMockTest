import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminResultTable } from "@/components/admin/result-table";
import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { EXAM_STATUS } from "@/lib/constants/exam";
import type { AdminResultSummary } from "@/types/reporting";

describe("ADMIN pending result table", () => {
  it("shows pending objective grading without a final score or grading control", () => {
    const result: AdminResultSummary = {
      id: "attempt-id",
      student: {
        id: "student-id",
        username: "student",
        fullName: "Hoc Sinh",
        isActive: true,
      },
      exam: {
        id: "exam-id",
        title: "Essay Exam",
        status: EXAM_STATUS.PUBLISHED,
      },
      attemptNumber: 1,
      status: EXAM_ATTEMPT_STATUS.SUBMITTED,
      startedAt: "2026-08-11T01:00:00.000Z",
      expiresAt: "2026-08-11T02:30:00.000Z",
      submittedAt: "2026-08-11T02:00:00.000Z",
      timeUsedSeconds: 3600,
      gradingStatus: EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL,
      objectiveScore: { earned: 2, maximum: 6 },
    };

    const markup = renderToStaticMarkup(
      <AdminResultTable results={[result]} />,
    );

    expect(markup).toContain("Chờ chấm tự luận");
    expect(markup).toContain("Đã chấm tự động: 2,00 / 6,00");
    expect(markup).not.toContain("Chưa có");
    expect(markup).not.toContain("Chấm bài");
    expect(markup).not.toContain("Nhập điểm");
    expect(markup).not.toContain("<input");
  });
});
