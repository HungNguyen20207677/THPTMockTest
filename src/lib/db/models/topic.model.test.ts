import { describe, expect, it } from "vitest";

import { TopicModel } from "@/lib/db/models/topic.model";

describe("Topic model", () => {
  it("has one unique normalized-name index", () => {
    const normalizedNameIndexes = TopicModel.schema
      .indexes()
      .filter(([fields]) => fields.normalizedName === 1);

    expect(normalizedNameIndexes).toEqual([
      [{ normalizedName: 1 }, expect.objectContaining({ unique: true })],
    ]);
  });
});
