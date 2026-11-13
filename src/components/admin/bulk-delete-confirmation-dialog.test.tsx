// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BulkDeleteConfirmationDialog } from "@/components/admin/bulk-delete-confirmation-dialog";

describe("BulkDeleteConfirmationDialog", () => {
  afterEach(cleanup);

  it("shows the exact scoped count and requires explicit confirmation", () => {
    const onConfirm = vi.fn();
    render(
      <BulkDeleteConfirmationDialog
        open
        count={2}
        entityLabel="đề thi"
        description="Xóa các đề đã chọn?"
        isPending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Xóa 2 đề thi đã chọn?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa 2 đề thi" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables confirmation while deletion is pending", () => {
    render(
      <BulkDeleteConfirmationDialog
        open
        count={2}
        entityLabel="học sinh"
        description="Xóa các học sinh đã chọn?"
        isPending
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: "Đang xóa..." })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
