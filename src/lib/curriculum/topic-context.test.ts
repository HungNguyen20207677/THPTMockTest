import { describe, expect, it } from "vitest";

import {
  addTopicSelection,
  getTopicContext,
  topicMatchesSearch,
} from "@/lib/curriculum/topic-context";
import type { Chapter, Grade } from "@/types/curriculum";
import type { Topic } from "@/types/topic";

const timestamp = "2026-09-01T00:00:00.000Z";
const grade: Grade = {
  id: "grade-id",
  name: "Khối 12",
  sortOrder: 12,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const chapter: Chapter = {
  id: "chapter-id",
  gradeId: grade.id,
  name: "Nguyên hàm - Tích phân",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const topic: Topic = {
  id: "topic-id",
  chapterId: chapter.id,
  name: "Tích phân",
  createdAt: timestamp,
  updatedAt: timestamp,
};

describe("Topic hierarchy context", () => {
  it("exposes Grade and Chapter context for Exam selectors", () => {
    expect(getTopicContext(topic, [chapter], [grade])).toBe(
      "Khối 12 › Nguyên hàm - Tích phân",
    );
    expect(topicMatchesSearch(topic, "khối 12", [chapter], [grade])).toBe(true);
  });

  it("labels legacy Topics as unclassified", () => {
    expect(getTopicContext({ ...topic, chapterId: undefined }, [], [])).toBe(
      "Chưa phân loại",
    );
  });

  it("automatically adds an inline-created Topic to the question selection", () => {
    expect(addTopicSelection(["existing-topic"], topic.id)).toEqual([
      "existing-topic",
      topic.id,
    ]);
    expect(addTopicSelection([topic.id], topic.id)).toEqual([topic.id]);
  });
});
