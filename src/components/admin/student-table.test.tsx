import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(markup).toContain("Đang khóa...");
    expect(markup).toContain('aria-label="Đang khóa tài khoản Học Sinh"');
    expect(markup).toContain("disabled:cursor-not-allowed");
  });
});
