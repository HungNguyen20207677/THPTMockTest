import { normalizeCurriculumName } from "@/lib/utils/topic-name";
import type { Chapter, Grade } from "@/types/curriculum";
import type { Topic } from "@/types/topic";

export function getTopicContext(
  topic: Topic,
  chapters: Chapter[],
  grades: Grade[],
): string {
  if (!topic.chapterId) {
    return "Chưa phân loại";
  }

  const chapter = chapters.find(
    (candidate) => candidate.id === topic.chapterId,
  );
  if (!chapter) {
    return "Chưa phân loại";
  }

  const grade = grades.find((candidate) => candidate.id === chapter.gradeId);
  return grade ? `${grade.name} › ${chapter.name}` : chapter.name;
}

export function topicMatchesSearch(
  topic: Topic,
  search: string,
  chapters: Chapter[],
  grades: Grade[],
): boolean {
  const normalizedSearch = normalizeCurriculumName(search);
  return normalizeCurriculumName(
    `${topic.name} ${getTopicContext(topic, chapters, grades)}`,
  ).includes(normalizedSearch);
}

export function addTopicSelection(
  selectedTopicIds: string[],
  topicId: string,
): string[] {
  return selectedTopicIds.includes(topicId)
    ? selectedTopicIds
    : [...selectedTopicIds, topicId];
}
