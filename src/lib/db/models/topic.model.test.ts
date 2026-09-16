import { describe, expect, it } from "vitest";

import { TopicModel } from "@/lib/db/models/topic.model";

describe("Topic model", () => {
  it("has one Chapter-scoped unique normalized-name index", () => {
    const normalizedNameIndexes = TopicModel.schema
      .indexes()
      .filter(([fields]) => fields.normalizedName === 1);

    expect(normalizedNameIndexes).toEqual([
      [
        { chapterId: 1, normalizedName: 1 },
        expect.objectContaining({
          unique: true,
          partialFilterExpression: { chapterId: { $type: "objectId" } },
        }),
      ],
    ]);
  });

  it("keeps legacy Topics without chapterId valid", () => {
    const topic = new TopicModel({
      name: "Chủ đề cũ",
      normalizedName: "chủ đề cũ",
    });

    expect(topic.validateSync()).toBeUndefined();
    expect(topic.chapterId).toBeUndefined();
  });
});
