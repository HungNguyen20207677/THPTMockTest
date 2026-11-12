// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bulkDeleteTopicRecords: vi.fn(),
  importTopicRecords: vi.fn(),
  previewTopicImport: vi.fn(),
}));

vi.mock("@/lib/api/topics", () => ({
  bulkDeleteTopicRecords: mocks.bulkDeleteTopicRecords,
  importTopicRecords: mocks.importTopicRecords,
  previewTopicImport: mocks.previewTopicImport,
}));

import { TopicBulkDeleteDialog } from "@/components/admin/topic-bulk-delete-dialog";
import { TopicImportDialog } from "@/components/admin/topic-import-dialog";

describe("Topic bulk actions", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  afterEach(cleanup);

  it("requires the typed phrase before deleting all displayed Topics", async () => {
    mocks.bulkDeleteTopicRecords.mockResolvedValue({
      data: { deletedCount: 1 },
    });
    const onDeleted = vi.fn();

    render(
      <TopicBulkDeleteDialog
        topics={[
          {
            id: "64b000000000000000000011",
            chapterId: "64b000000000000000000021",
            name: "Cực trị",
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ]}
        scopeLabel="1 kết quả cho bộ lọc “Cực”"
        requireTypedConfirmation
        onClose={vi.fn()}
        onDeleted={onDeleted}
        onError={vi.fn()}
      />,
    );

    const deleteButton = screen.getByRole("button", {
      name: "Xóa 1 chủ đề",
    });
    expect(deleteButton.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText(/Nhập/), {
      target: { value: "XÓA" },
    });
    expect(deleteButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(deleteButton);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(1));
    expect(mocks.bulkDeleteTopicRecords).toHaveBeenCalledWith({
      topics: [
        {
          id: "64b000000000000000000011",
          expectedUpdatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("uses the server preview before enabling a JSON import", async () => {
    mocks.previewTopicImport.mockResolvedValue({
      data: {
        preview: {
          items: [
            {
              grade: "Khối 12",
              chapter: "Hàm số",
              topic: "Cực trị",
              status: "CREATE",
            },
          ],
          summary: {
            totalCount: 1,
            createCount: 1,
            skippedCount: 0,
            errorCount: 0,
          },
          canImport: true,
        },
      },
    });
    mocks.importTopicRecords.mockResolvedValue({
      data: { result: { createdCount: 1, skippedCount: 0 } },
    });
    const onImported = vi.fn();

    render(<TopicImportDialog onClose={vi.fn()} onImported={onImported} />);
    expect(
      screen
        .getByRole("button", { name: "Nhập chủ đề" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));

    await screen.findByText("Tạo mới: 1");
    const importButton = screen.getByRole("button", { name: "Nhập chủ đề" });
    expect(importButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(importButton);

    await waitFor(() => expect(onImported).toHaveBeenCalledWith(1, 0));
    expect(mocks.previewTopicImport).toHaveBeenCalledTimes(1);
    expect(mocks.importTopicRecords).toHaveBeenCalledTimes(1);
  });
});
