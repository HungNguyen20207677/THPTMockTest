// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardNavigation } from "@/components/shared/dashboard-navigation";
import type { AppUser } from "@/types/user";

const mocks = vi.hoisted(() => ({
  pathname: "/admin",
  setTheme: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: mocks.setTheme }),
}));

const admin: AppUser = {
  id: "admin-id",
  username: "admin",
  fullName: "Quản Trị Viên",
  role: "ADMIN",
};

const adminItems = [
  { href: "/admin", label: "Tổng quan", icon: "layout-dashboard" as const },
  {
    href: "/admin/students",
    label: "Quản lý học sinh",
    icon: "users" as const,
  },
  { href: "/admin/exams", label: "Quản lý đề thi", icon: "file-text" as const },
];

afterEach(() => {
  cleanup();
  mocks.pathname = "/admin";
  mocks.setTheme.mockReset();
});

describe("DashboardNavigation", () => {
  it("keeps authorized links functional when the desktop sidebar is collapsed", () => {
    render(
      <DashboardNavigation user={admin} items={adminItems}>
        <main>Nội dung</main>
      </DashboardNavigation>,
    );

    expect(
      screen.getByRole("link", { name: "Quản lý đề thi" }).getAttribute("href"),
    ).toBe("/admin/exams");

    fireEvent.click(screen.getByRole("button", { name: "Thu gọn thanh bên" }));

    expect(
      screen
        .getByRole("button", { name: "Mở rộng thanh bên" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen.getByRole("link", { name: "Quản lý đề thi" }).getAttribute("href"),
    ).toBe("/admin/exams");
  });

  it("closes the mobile drawer after navigation", () => {
    render(
      <DashboardNavigation user={admin} items={adminItems}>
        <main>Nội dung</main>
      </DashboardNavigation>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở menu điều hướng" }));
    const drawer = screen.getByRole("dialog", { name: "Menu điều hướng" });
    const destination = within(drawer).getByRole("link", {
      name: "Quản lý đề thi",
    });
    destination.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(destination);

    expect(
      screen.queryByRole("dialog", { name: "Menu điều hướng" }),
    ).toBeNull();
  });

  it("renders only the role-specific destinations it receives", () => {
    const student: AppUser = {
      id: "student-id",
      username: "student",
      fullName: "Học Sinh",
      role: "STUDENT",
    };
    mocks.pathname = "/student";

    render(
      <DashboardNavigation
        user={student}
        items={[
          {
            href: "/student",
            label: "Trang chính",
            icon: "graduation-cap",
          },
        ]}
      >
        <main>Nội dung</main>
      </DashboardNavigation>,
    );

    expect(
      screen.getByRole("link", { name: "Trang chính" }).getAttribute("href"),
    ).toBe("/student");
    expect(screen.queryByRole("link", { name: "Quản lý học sinh" })).toBeNull();
  });
});
