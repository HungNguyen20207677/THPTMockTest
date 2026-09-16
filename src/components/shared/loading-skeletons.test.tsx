import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ManagementTableSkeleton,
  StudentPickerSkeleton,
  TopicSelectorSkeleton,
} from "@/components/shared/loading-skeletons";

describe("loading skeletons", () => {
  it("renders a shaped table fallback with an accessible status", () => {
    const markup = renderToStaticMarkup(
      <ManagementTableSkeleton
        columns={5}
        label="Đang tải danh sách học sinh"
      />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Đang tải danh sách học sinh");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup.match(/data-slot="skeleton"/g)?.length).toBeGreaterThan(20);
  });

  it("uses compact shapes for topic and student picker loading states", () => {
    const topicMarkup = renderToStaticMarkup(<TopicSelectorSkeleton />);
    const studentMarkup = renderToStaticMarkup(<StudentPickerSkeleton />);

    expect(topicMarkup).toContain("Đang tải danh sách chủ đề");
    expect(studentMarkup).toContain("Đang tải danh sách học sinh");
    expect(topicMarkup).toContain("motion-reduce:animate-none");
    expect(studentMarkup).toContain('aria-hidden="true"');
  });
});
