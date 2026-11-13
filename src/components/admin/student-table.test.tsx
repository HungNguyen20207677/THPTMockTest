// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudentTable } from "@/components/admin/student-table";
import type { StudentAccount } from "@/types/user";

const student: StudentAccount = {
  id: "student-id",
  username: "hoc-sinh",
  fullName: "Học Sinh",
  isActive: true,
  createdAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T00:00:00.000Z",
};

describe("StudentTable pending actions", () => {
  it("shows and disables the row-specific status action while pending", () => {
    const markup = renderToStaticMarkup(
      <StudentTable
        students={[student]}
        isBusy
        pendingStatusStudentId={student.id}
        selectedIds={new Set()}
        onToggleSelected={vi.fn()}
        onToggleAll={vi.fn()}
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(markup).toContain('aria-label="Đang khóa tài khoản Học Sinh"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("disabled:cursor-not-allowed");
  });

  it("keeps icon action handlers and accessible labels intact", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <StudentTable
        students={[student]}
        isBusy={false}
        selectedIds={new Set()}
        onToggleSelected={vi.fn()}
        onToggleAll={vi.fn()}
        onEdit={onEdit}
        onResetPassword={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Sửa tài khoản Học Sinh" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Xóa tài khoản Học Sinh" }),
    );

    expect(onEdit).toHaveBeenCalledWith(student, expect.any(HTMLButtonElement));
    expect(onDelete).toHaveBeenCalledWith(
      student,
      expect.any(HTMLButtonElement),
    );
  });

  it("selects one row or every row without invoking destructive actions", () => {
    const onToggleSelected = vi.fn();
    const onToggleAll = vi.fn();
    const onDelete = vi.fn();
    render(
      <StudentTable
        students={[student]}
        isBusy={false}
        selectedIds={new Set()}
        onToggleSelected={onToggleSelected}
        onToggleAll={onToggleAll}
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByLabelText("Chọn học sinh Học Sinh"));
    fireEvent.click(
      screen.getByLabelText("Chọn tất cả học sinh trên trang hiện tại"),
    );

    expect(onToggleSelected).toHaveBeenCalledWith(student.id);
    expect(onToggleAll).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});

afterEach(cleanup);
