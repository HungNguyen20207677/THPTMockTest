// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/shared/theme-toggle";

const mocks = vi.hoisted(() => ({
  resolvedTheme: "light",
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: mocks.resolvedTheme,
    setTheme: mocks.setTheme,
  }),
}));

afterEach(() => {
  cleanup();
  mocks.resolvedTheme = "light";
  mocks.setTheme.mockReset();
});

describe("ThemeToggle", () => {
  it("sets an explicit opposite theme from the resolved system theme", () => {
    const { rerender } = render(<ThemeToggle />);

    fireEvent.click(
      screen.getByRole("button", { name: "Chuyển sang giao diện tối" }),
    );
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");

    mocks.resolvedTheme = "dark";
    rerender(<ThemeToggle />);
    fireEvent.click(
      screen.getByRole("button", { name: "Chuyển sang giao diện sáng" }),
    );
    expect(mocks.setTheme).toHaveBeenLastCalledWith("light");
  });
});
