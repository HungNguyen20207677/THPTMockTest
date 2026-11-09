"use client";

import { useEffect, useState } from "react";

import {
  CurriculumEditor,
  type CurriculumEditorTarget,
} from "@/components/admin/curriculum-editor";
import { CurriculumTreeSkeleton } from "@/components/shared/loading-skeletons";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import {
  deleteChapterRecord,
  deleteGradeRecord,
  fetchChapters,
  fetchGrades,
} from "@/lib/api/curriculum";
import { deleteTopicRecord, fetchTopics } from "@/lib/api/topics";
import type { Chapter, Grade } from "@/types/curriculum";
import type { Topic } from "@/types/topic";

type DeleteTarget =
  | { kind: "grade"; value: Grade }
  | { kind: "chapter"; value: Chapter }
  | { kind: "topic"; value: Topic };

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }
    return error.message;
  }
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

function ActionButtons({
  label,
  onEdit,
  onDelete,
  disabled,
  deletePending = false,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
  deletePending?: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled}
        aria-label={`Sửa ${label}`}
        onClick={onEdit}
      >
        Sửa
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={disabled}
        aria-label={`Xóa ${label}`}
        onClick={onDelete}
      >
        {deletePending ? "Đang xóa..." : "Xóa"}
      </Button>
    </div>
  );
}

export function CurriculumManagement() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editor, setEditor] = useState<CurriculumEditorTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    void Promise.all([fetchGrades(), fetchChapters(), fetchTopics()])
      .then(([gradeResponse, chapterResponse, topicResponse]) => {
        if (isCurrent) {
          setGrades(gradeResponse.data.grades);
          setChapters(chapterResponse.data.chapters);
          setTopics(topicResponse.data.topics);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshVersion]);

  const isBusy = Boolean(deleteTarget);
  const unclassifiedTopics = topics.filter((topic) => !topic.chapterId);

  function refreshCatalog() {
    setEditor(null);
    setActionError(null);
    setLoadError(null);
    setIsLoading(true);
    setRefreshVersion((version) => version + 1);
  }

  function refreshAfterConflict(message: string) {
    setEditor(null);
    setActionError(message);
    setIsLoading(true);
    setRefreshVersion((version) => version + 1);
  }

  async function handleDelete(target: DeleteTarget) {
    const labels = {
      grade: "khối",
      chapter: "chương",
      topic: "chủ đề",
    } as const;
    if (!window.confirm(`Xóa ${labels[target.kind]} “${target.value.name}”?`)) {
      return;
    }

    setDeleteTarget(target);
    setActionError(null);
    try {
      if (target.kind === "grade") {
        await deleteGradeRecord(target.value.id, {
          expectedUpdatedAt: target.value.updatedAt,
        });
      } else if (target.kind === "chapter") {
        await deleteChapterRecord(target.value.id, {
          expectedUpdatedAt: target.value.updatedAt,
        });
      } else {
        await deleteTopicRecord(target.value.id, {
          expectedUpdatedAt: target.value.updatedAt,
        });
      }
      refreshCatalog();
    } catch (error) {
      const message = getErrorMessage(error);
      if (
        error instanceof ApiClientError &&
        error.code === "CURRICULUM_CONFLICT"
      ) {
        refreshAfterConflict(message);
      } else {
        setActionError(message);
      }
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-7">
      <div className="border-border flex flex-col gap-4 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-primary text-xs font-semibold tracking-widest uppercase">
            Danh mục kiến thức
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Chủ đề & kiến thức
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6 sm:text-base">
            Quản lý cây kiến thức động theo Khối → Chương → Chủ đề.
          </p>
        </div>
        <Button
          type="button"
          disabled={isBusy}
          onClick={() => setEditor({ kind: "create-grade" })}
        >
          <span aria-hidden="true">+</span>
          Thêm khối
        </Button>
      </div>

      {editor && (
        <CurriculumEditor
          key={
            editor.kind === "edit-grade"
              ? editor.grade.id
              : editor.kind === "edit-chapter"
                ? editor.chapter.id
                : editor.kind === "edit-topic"
                  ? editor.topic.id
                  : `${editor.kind}-${"gradeId" in editor ? editor.gradeId : "chapterId" in editor ? editor.chapterId : "new"}`
          }
          target={editor}
          grades={grades}
          chapters={chapters}
          onCancel={() => setEditor(null)}
          onConflict={refreshAfterConflict}
          onSaved={refreshCatalog}
        />
      )}

      {actionError && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {actionError}
        </p>
      )}

      {loadError ? (
        <div className="border-border space-y-3 rounded-xl border p-5">
          <p role="alert" className="text-destructive text-sm">
            {loadError}
          </p>
          <Button type="button" variant="outline" onClick={refreshCatalog}>
            Thử lại
          </Button>
        </div>
      ) : isLoading ? (
        <CurriculumTreeSkeleton />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Cây kiến thức</h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {grades.length} khối · {chapters.length} chương ·{" "}
                {topics.length} chủ đề
              </p>
            </div>
            <div className="text-muted-foreground hidden items-center gap-2 text-xs sm:flex">
              <span className="bg-primary/10 text-primary rounded px-2 py-1">
                Khối
              </span>
              <span aria-hidden="true">→</span>
              <span className="bg-muted rounded px-2 py-1">Chương</span>
              <span aria-hidden="true">→</span>
              <span className="border-border rounded border px-2 py-1">
                Chủ đề
              </span>
            </div>
          </div>
          {grades.map((grade) => {
            const gradeChapters = chapters.filter(
              (chapter) => chapter.gradeId === grade.id,
            );
            return (
              <section
                key={grade.id}
                className="border-border bg-card rounded-lg border shadow-xs"
              >
                <div className="border-border bg-primary/[0.025] flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-bold">
                      K
                    </span>
                    <div>
                      <h3 className="font-semibold">{grade.name}</h3>
                      <p className="text-muted-foreground text-xs">
                        Thứ tự {grade.sortOrder} · {gradeChapters.length} chương
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 sm:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() =>
                        setEditor({ kind: "create-chapter", gradeId: grade.id })
                      }
                    >
                      + Thêm chương
                    </Button>
                    <ActionButtons
                      label={`khối ${grade.name}`}
                      disabled={isBusy}
                      deletePending={
                        deleteTarget?.kind === "grade" &&
                        deleteTarget.value.id === grade.id
                      }
                      onEdit={() => setEditor({ kind: "edit-grade", grade })}
                      onDelete={() =>
                        void handleDelete({ kind: "grade", value: grade })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3 p-3 sm:p-4">
                  {gradeChapters.map((chapter) => {
                    const chapterTopics = topics
                      .filter((topic) => topic.chapterId === chapter.id)
                      .sort((first, second) =>
                        first.name.localeCompare(second.name, "vi"),
                      );
                    return (
                      <div
                        key={chapter.id}
                        className="border-border overflow-hidden rounded-md border"
                      >
                        <div className="bg-muted/40 border-border flex flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="bg-background text-muted-foreground flex size-7 items-center justify-center rounded border text-xs font-semibold">
                              C
                            </span>
                            <div>
                              <h4 className="text-sm font-semibold">
                                {chapter.name}
                              </h4>
                              <p className="text-muted-foreground text-xs">
                                {chapterTopics.length} chủ đề
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 sm:justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() =>
                                setEditor({
                                  kind: "create-topic",
                                  chapterId: chapter.id,
                                })
                              }
                            >
                              + Thêm chủ đề
                            </Button>
                            <ActionButtons
                              label={`chương ${chapter.name}`}
                              disabled={isBusy}
                              deletePending={
                                deleteTarget?.kind === "chapter" &&
                                deleteTarget.value.id === chapter.id
                              }
                              onEdit={() =>
                                setEditor({ kind: "edit-chapter", chapter })
                              }
                              onDelete={() =>
                                void handleDelete({
                                  kind: "chapter",
                                  value: chapter,
                                })
                              }
                            />
                          </div>
                        </div>
                        {chapterTopics.length > 0 ? (
                          <ul className="divide-border divide-y">
                            {chapterTopics.map((topic) => (
                              <li
                                key={topic.id}
                                className="hover:bg-muted/20 flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors"
                              >
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <span className="bg-primary/60 size-1.5 shrink-0 rounded-full" />
                                  <span className="truncate">{topic.name}</span>
                                </span>
                                <ActionButtons
                                  label={`chủ đề ${topic.name}`}
                                  disabled={isBusy}
                                  deletePending={
                                    deleteTarget?.kind === "topic" &&
                                    deleteTarget.value.id === topic.id
                                  }
                                  onEdit={() =>
                                    setEditor({ kind: "edit-topic", topic })
                                  }
                                  onDelete={() =>
                                    void handleDelete({
                                      kind: "topic",
                                      value: topic,
                                    })
                                  }
                                />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-muted-foreground px-3 py-4 text-center text-sm">
                            Chưa có chủ đề trong chương này.
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {gradeChapters.length === 0 && (
                    <div className="border-border text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
                      Chưa có chương trong khối này.
                    </div>
                  )}
                </div>
              </section>
            );
          })}

          {grades.length === 0 && (
            <div className="border-border bg-card rounded-lg border border-dashed p-10 text-center">
              <p className="font-medium">Chưa có khối kiến thức</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Tạo khối đầu tiên để bắt đầu xây dựng cây kiến thức.
              </p>
            </div>
          )}

          {unclassifiedTopics.length > 0 && (
            <section className="border-amber-300 bg-amber-50/60 rounded-lg border shadow-xs dark:border-amber-800 dark:bg-amber-950/20">
              <div className="border-amber-300 border-b px-4 py-3 dark:border-amber-800">
                <h2 className="font-semibold text-amber-950 dark:text-amber-100">
                  Chưa phân loại
                </h2>
                <p className="text-muted-foreground text-xs">
                  Chủ đề cũ chưa được gắn chương
                </p>
              </div>
              <ul className="divide-border divide-y">
                {unclassifiedTopics.map((topic) => (
                  <li
                    key={topic.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <span>{topic.name}</span>
                    <ActionButtons
                      label={`chủ đề ${topic.name}`}
                      disabled={isBusy}
                      deletePending={
                        deleteTarget?.kind === "topic" &&
                        deleteTarget.value.id === topic.id
                      }
                      onEdit={() => setEditor({ kind: "edit-topic", topic })}
                      onDelete={() =>
                        void handleDelete({ kind: "topic", value: topic })
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
