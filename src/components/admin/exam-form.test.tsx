// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PracticeEnabledControl } from "@/components/admin/exam-form";

describe("PracticeEnabledControl", () => {
  it("is off by default and explains how Practice differs from Mock", () => {
    const onChange = vi.fn();
    render(
      <PracticeEnabledControl name="practiceEnabled" onChange={onChange} />,
    );

    const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /Cho phép luyện tập/,
    });
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText(/không giới hạn thời gian/)).toBeTruthy();
    expect(screen.getByText(/chưa được kích hoạt toàn hệ thống/)).toBeTruthy();

    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledOnce();
    expect(checkbox.checked).toBe(true);
  });
});
