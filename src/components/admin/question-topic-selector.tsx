"use client";

import { useDeferredValue, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/lib/api/client";
import { normalizeTopicName } from "@/lib/utils/topic-name";
import { topicNameSchema } from "@/lib/validations/topic";
import type { Topic } from "@/types/topic";

interface QuestionTopicSelectorProps {
  label: string;
  topics: Topic[];
  value: string[];
  disabled?: boolean;
  isLoading: boolean;
  loadError: string | null;
  onChange: (topicIds: string[]) => void;
  onCreateTopic: (name: string) => Promise<Topic>;
  onRetry: () => void;
}

export function QuestionTopicSelector({
  label,
  topics,
  value,
  disabled = false,
  isLoading,
  loadError,
  onChange,
  onCreateTopic,
  onRetry,
}: QuestionTopicSelectorProps) {
  const generatedId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = normalizeTopicName(deferredSearch);
  const filteredTopics = normalizedSearch
    ? topics.filter((topic) =>
        normalizeTopicName(topic.name).includes(normalizedSearch),
      )
    : topics;
  const parsedTopicName = topicNameSchema.safeParse(search);
  const hasExactMatch = parsedTopicName.success
    ? topics.some(
        (topic) =>
          normalizeTopicName(topic.name) ===
          normalizeTopicName(parsedTopicName.data),
      )
    : true;
  const listId = `${generatedId}-list`;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function createAndSelectTopic(name: string) {
    setIsCreating(true);
    setCreateError(null);

    try {
      const topic = await onCreateTopic(name);
      onChange(value.includes(topic.id) ? value : [...value, topic.id]);
      setSearch("");
      setIsOpen(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.code === "UNAUTHENTICATED") {
          window.location.replace("/login");
        } else if (error.code === "FORBIDDEN") {
          window.location.replace("/");
        }

        setCreateError(error.message);
      } else {
        setCreateError("Không thể tạo chủ đề. Vui lòng thử lại.");
      }
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((topicId) => {
            const topic = topics.find((candidate) => candidate.id === topicId);

            return (
              <span
                key={topicId}
                className="bg-secondary text-secondary-foreground inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs"
              >
                <span className="truncate">
                  {topic?.name ?? `Chủ đề ${topicId.slice(-6)}`}
                </span>
                <button
                  type="button"
                  className="hover:bg-foreground/10 focus-visible:ring-ring/50 rounded px-0.5 font-semibold outline-none focus-visible:ring-2"
                  disabled={disabled || isCreating}
                  aria-label={`Bỏ chủ đề ${topic?.name ?? topicId}`}
                  onClick={() =>
                    onChange(
                      value.filter((selectedId) => selectedId !== topicId),
                    )
                  }
                >
                  x
                </button>
              </span>
            );
          })}
        </div>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full justify-between font-normal"
        disabled={disabled || isCreating}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        onClick={() => {
          setCreateError(null);
          setIsOpen((open) => !open);
        }}
      >
        <span>
          {value.length > 0 ? `${value.length} chủ đề` : "Chọn chủ đề"}
        </span>
        <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
      </Button>

      {isOpen && (
        <div
          id={listId}
          className="border-border bg-background absolute inset-x-0 z-30 mt-1 w-full space-y-2 rounded-lg border p-2 shadow-lg"
        >
          <Input
            autoFocus
            type="search"
            value={search}
            placeholder="Tìm chủ đề"
            aria-label="Tìm chủ đề"
            disabled={isCreating}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();

              if (
                !isLoading &&
                !loadError &&
                parsedTopicName.success &&
                !hasExactMatch &&
                !isCreating
              ) {
                void createAndSelectTopic(parsedTopicName.data);
              }
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              setCreateError(null);
            }}
          />

          {isLoading ? (
            <p
              role="status"
              className="text-muted-foreground px-2 py-3 text-sm"
            >
              Đang tải chủ đề...
            </p>
          ) : loadError ? (
            <div className="space-y-2 px-2 py-1">
              <p role="alert" className="text-destructive text-sm">
                {loadError}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetry}
              >
                Thử lại
              </Button>
            </div>
          ) : (
            <div className="border-border max-h-52 overflow-y-auto rounded-md border">
              {filteredTopics.map((topic) => (
                <label
                  key={topic.id}
                  className="border-border flex cursor-pointer items-center gap-2 border-b px-2.5 py-2 text-sm last:border-b-0"
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={value.includes(topic.id)}
                    disabled={isCreating}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...new Set([...value, topic.id])]
                          : value.filter((topicId) => topicId !== topic.id),
                      )
                    }
                  />
                  <span className="min-w-0 truncate">{topic.name}</span>
                </label>
              ))}
              {filteredTopics.length === 0 && (
                <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                  Không tìm thấy chủ đề phù hợp.
                </p>
              )}
            </div>
          )}

          {!isLoading &&
            !loadError &&
            parsedTopicName.success &&
            !hasExactMatch && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-2 text-left whitespace-normal"
                disabled={isCreating}
                onClick={() => void createAndSelectTopic(parsedTopicName.data)}
              >
                {isCreating
                  ? "Đang tạo chủ đề..."
                  : `+ Tạo chủ đề "${parsedTopicName.data}"`}
              </Button>
            )}
          {createError && (
            <p role="alert" className="text-destructive px-2 text-sm">
              {createError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
