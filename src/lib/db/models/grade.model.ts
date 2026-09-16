import "server-only";

import { model, models, Schema, type Model } from "mongoose";

import { GRADE_NAME_MAX_LENGTH } from "@/lib/constants/curriculum";

export interface GradeRecord {
  name: string;
  normalizedName: string;
  sortOrder: number;
  integrityRevision?: number;
  createdAt: Date;
  updatedAt: Date;
}

const gradeSchema = new Schema<GradeRecord>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: GRADE_NAME_MAX_LENGTH,
    },
    normalizedName: {
      type: String,
      required: true,
      maxlength: GRADE_NAME_MAX_LENGTH,
    },
    sortOrder: { type: Number, required: true },
    integrityRevision: { type: Number, default: 0, select: false },
  },
  { timestamps: true, versionKey: false },
);

gradeSchema.index(
  { normalizedName: 1 },
  { unique: true, name: "unique_grade_normalized_name" },
);

export const GradeModel =
  (models.Grade as Model<GradeRecord> | undefined) ??
  model<GradeRecord>("Grade", gradeSchema);
