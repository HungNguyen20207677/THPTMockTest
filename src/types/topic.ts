export interface Topic {
  id: string;
  name: string;
  chapterId?: string;
  createdAt: string;
  updatedAt: string;
}

export type TopicImportItemStatus = "CREATE" | "SKIP_EXISTING" | "ERROR";

export interface TopicImportPreviewItem {
  grade: string;
  chapter: string;
  topic: string;
  status: TopicImportItemStatus;
  message?: string;
}

export interface TopicImportPreview {
  items: TopicImportPreviewItem[];
  summary: {
    totalCount: number;
    createCount: number;
    skippedCount: number;
    errorCount: number;
  };
  canImport: boolean;
}

export interface TopicImportResult {
  createdCount: number;
  skippedCount: number;
}
