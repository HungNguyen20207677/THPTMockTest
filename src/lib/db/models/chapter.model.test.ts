import { describe, expect, it } from "vitest";

import { ChapterModel } from "@/lib/db/models/chapter.model";

describe("Chapter model", () => {
  it("scopes normalized-name uniqueness to a Grade", () => {
    expect(ChapterModel.schema.indexes()).toContainEqual([
      { gradeId: 1, normalizedName: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });
});
