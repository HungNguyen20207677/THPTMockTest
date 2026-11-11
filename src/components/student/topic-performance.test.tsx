import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudentTopicPerformance } from "@/components/student/topic-performance";
import type { StudentTopicPerformanceReport } from "@/types/reporting";

const report: StudentTopicPerformanceReport = {
  attemptPolicy: "ALL_ELIGIBLE_TERMINAL_ATTEMPTS",
  minimumSampleSize: 3,
  topics: [
    {
      topicId: "small-sample",
      topicName: "Hàm số",
      gradeId: "grade-12",
      gradeName: "Lớp 12",
      chapterId: "chapter-functions",
      chapterName: "Khảo sát hàm số",
      performancePercent: 40,
      evaluatedQuestionCount: 2,
      includedAttemptCount: 1,
    },
    {
      topicId: "lower-performance",
      topicName: "Nguyên hàm",
      gradeId: "grade-12",
      gradeName: "Lớp 12",
      chapterId: "chapter-calculus",
      chapterName: "Nguyên hàm và tích phân",
      performancePercent: 40,
      evaluatedQuestionCount: 3,
      includedAttemptCount: 2,
    },
    {
      topicId: "insufficient",
      topicName: "Hình học không gian",
      performancePercent: null,
      evaluatedQuestionCount: 0,
      includedAttemptCount: 0,
    },
  ],
};

describe("Student Topic performance", () => {
  it("renders hierarchy, points semantics, sample sizes, and evidence labels", () => {
    const markup = renderToStaticMarkup(
      <StudentTopicPerformance report={report} />,
    );

    expect(markup).toContain("Năng lực theo chủ đề");
    expect(markup).toContain("tổng điểm đạt được trên tổng điểm tối đa");
    expect(markup).toContain("Lớp 12 · Khảo sát hàm số");
    expect(markup).toContain("2 lượt câu được đánh giá");
    expect(markup).toContain("1 lượt làm được tính");
    expect(markup).toContain("Mẫu nhỏ");
    expect(markup).toContain("Kết quả dưới 50%");
    expect(markup).toContain("Chưa đủ dữ liệu");
    expect(markup).toContain("40%");
  });

  it("renders an eligibility-aware empty state", () => {
    const markup = renderToStaticMarkup(
      <StudentTopicPerformance report={{ ...report, topics: [] }} />,
    );

    expect(markup).toContain("Chưa có dữ liệu chủ đề đủ điều kiện");
    expect(markup).toContain("kết quả được công bố");
  });
});
