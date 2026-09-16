import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button cursor behavior", () => {
  it("uses a pointer cursor for enabled buttons", () => {
    const markup = renderToStaticMarkup(<Button>Tiếp tục</Button>);

    expect(markup).toContain("cursor-pointer");
    expect(markup).not.toContain("disabled:pointer-events-none");
  });

  it("keeps disabled buttons targetable for not-allowed cursor feedback", () => {
    const markup = renderToStaticMarkup(<Button disabled>Đang lưu...</Button>);

    expect(markup).toContain('disabled=""');
    expect(markup).toContain("disabled:cursor-not-allowed");
    expect(markup).not.toContain("disabled:pointer-events-none");
  });

  it("propagates pointer styling to button links", () => {
    const markup = renderToStaticMarkup(
      <Button asChild>
        <a href="/admin/exams">Mở đề thi</a>
      </Button>,
    );

    expect(markup).toContain('href="/admin/exams"');
    expect(markup).toContain("cursor-pointer");
  });
});
