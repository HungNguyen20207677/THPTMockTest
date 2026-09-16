import { describe, expect, it } from "vitest";

import { GradeModel } from "@/lib/db/models/grade.model";

describe("Grade model", () => {
  it("declares a unique normalized-name index", () => {
    expect(GradeModel.schema.indexes()).toContainEqual([
      { normalizedName: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });
});
