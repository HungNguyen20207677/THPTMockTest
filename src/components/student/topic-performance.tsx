"use client";

import { useState } from "react";

import type {
  StudentTopicPerformanceItem,
  StudentTopicPerformanceReport,
} from "@/types/reporting";

const ALL_FILTER_VALUE = "all";
const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3 sm:w-56";

function uniqueNamedOptions(
  topics: StudentTopicPerformanceItem[],
  idKey: "gradeId" | "chapterId",
  nameKey: "gradeName" | "chapterName",
) {
  return [
    ...new Map(
      topics.flatMap((topic) => {
        const id = topic[idKey];
        const name = topic[nameKey];
        return id && name ? [[id, name] as const] : [];
      }),
    ).entries(),
  ].map(([id, name]) => ({ id, name }));
}

function TopicEvidence({
  topic,
  minimumSampleSize,
}: {
  topic: StudentTopicPerformanceItem;
  minimumSampleSize: number;
}) {
  if (topic.performancePercent === null) {
    return (
      <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-1 text-xs font-medium">
        Chưa đủ dữ liệu
      </span>
    );
  }

  if (topic.evaluatedQuestionCount < minimumSampleSize) {
    return (
      <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-1 text-xs font-medium">
        Mẫu nhỏ
      </span>
    );
  }

  if (topic.performancePercent < 50) {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
        Kết quả dưới 50%
      </span>
    );
  }

  return null;
}

export function StudentTopicPerformance({
  report,
}: {
  report: StudentTopicPerformanceReport;
}) {
  const [gradeId, setGradeId] = useState(ALL_FILTER_VALUE);
  const [chapterId, setChapterId] = useState(ALL_FILTER_VALUE);
  const grades = uniqueNamedOptions(report.topics, "gradeId", "gradeName");
  const gradeTopics =
    gradeId === ALL_FILTER_VALUE
      ? report.topics
      : report.topics.filter((topic) => topic.gradeId === gradeId);
  const chapters = uniqueNamedOptions(gradeTopics, "chapterId", "chapterName");
  const visibleTopics = gradeTopics.filter(
    (topic) => chapterId === ALL_FILTER_VALUE || topic.chapterId === chapterId,
  );
  const evaluatedQuestionCount = visibleTopics.reduce(
    (total, topic) => total + topic.evaluatedQuestionCount,
    0,
  );

  return (
    <section aria-labelledby="topic-performance-heading" className="mt-10">
      <div className="border-border flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-primary text-xs font-semibold tracking-widest uppercase">
            Tổng hợp kết quả
          </p>
          <h2
            id="topic-performance-heading"
            className="mt-1 text-xl font-bold tracking-tight sm:text-2xl"
          >
            Năng lực theo chủ đề
          </h2>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
            Tỷ lệ được tính theo tổng điểm đạt được trên tổng điểm tối đa. Mỗi
            lượt đã nộp có cả điểm và đáp án được công bố đều được tính; câu tự
            luận chỉ được tính sau khi chấm xong.
          </p>
        </div>
        <div className="text-muted-foreground text-sm tabular-nums">
          {visibleTopics.length} chủ đề · {evaluatedQuestionCount} lượt câu được
          đánh giá
        </div>
      </div>

      {report.topics.length === 0 ? (
        <div className="border-border bg-muted/30 mt-5 rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">Chưa có dữ liệu chủ đề đủ điều kiện</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Dữ liệu sẽ xuất hiện khi có bài đã nộp và kết quả được công bố.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="space-y-1 text-sm font-medium">
              <span className="block">Khối lớp</span>
              <select
                className={selectClassName}
                value={gradeId}
                onChange={(event) => {
                  setGradeId(event.target.value);
                  setChapterId(ALL_FILTER_VALUE);
                }}
              >
                <option value={ALL_FILTER_VALUE}>Tất cả khối lớp</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span className="block">Chương</span>
              <select
                className={selectClassName}
                value={chapterId}
                onChange={(event) => setChapterId(event.target.value)}
              >
                <option value={ALL_FILTER_VALUE}>Tất cả chương</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {visibleTopics.length === 0 ? (
            <div className="border-border bg-muted/30 mt-5 rounded-xl border border-dashed p-6 text-center text-sm">
              Không có chủ đề phù hợp với bộ lọc đã chọn.
            </div>
          ) : (
            <div className="border-border mt-5 divide-y rounded-xl border">
              {visibleTopics.map((topic) => {
                const percentage = topic.performancePercent;
                const width =
                  percentage === null
                    ? 0
                    : Math.min(100, Math.max(0, percentage));

                return (
                  <article
                    key={topic.topicId}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{topic.topicName}</h3>
                        <TopicEvidence
                          topic={topic}
                          minimumSampleSize={report.minimumSampleSize}
                        />
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {topic.gradeName && topic.chapterName
                          ? `${topic.gradeName} · ${topic.chapterName}`
                          : "Chưa phân loại theo khối và chương"}
                      </p>
                      <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                        {topic.evaluatedQuestionCount} lượt câu được đánh giá ·{" "}
                        {topic.includedAttemptCount} lượt làm được tính
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                          Hiệu suất theo điểm
                        </span>
                        <span className="font-semibold tabular-nums">
                          {percentage === null
                            ? "Chưa đủ dữ liệu"
                            : `${percentage.toLocaleString("vi-VN", {
                                maximumFractionDigits: 1,
                              })}%`}
                        </span>
                      </div>
                      <div
                        className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
                        role="progressbar"
                        aria-label={`Hiệu suất chủ đề ${topic.topicName}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percentage === null ? undefined : width}
                      >
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
