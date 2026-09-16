import "server-only";

import { model, models, Schema, Types, type Model } from "mongoose";

import { CHAPTER_NAME_MAX_LENGTH } from "@/lib/constants/curriculum";

export interface ChapterRecord {
  gradeId: Types.ObjectId;
  name: string;
  normalizedName: string;
  integrityRevision?: number;
  createdAt: Date;
  updatedAt: Date;
}

const chapterSchema = new Schema<ChapterRecord>(
  {
    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: CHAPTER_NAME_MAX_LENGTH,
    },
    normalizedName: {
      type: String,
      required: true,
      maxlength: CHAPTER_NAME_MAX_LENGTH,
    },
    integrityRevision: { type: Number, default: 0, select: false },
  },
  { timestamps: true, versionKey: false },
);

chapterSchema.index(
  { gradeId: 1, normalizedName: 1 },
  { unique: true, name: "unique_chapter_name_per_grade" },
);

export const ChapterModel =
  (models.Chapter as Model<ChapterRecord> | undefined) ??
  model<ChapterRecord>("Chapter", chapterSchema);
