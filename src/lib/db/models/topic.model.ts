import "server-only";

import { model, models, Schema, Types, type Model } from "mongoose";

import { TOPIC_NAME_MAX_LENGTH } from "@/lib/constants/topic";

export interface TopicRecord {
  chapterId?: Types.ObjectId;
  name: string;
  normalizedName: string;
  integrityRevision?: number;
  createdAt: Date;
  updatedAt: Date;
}

const topicSchema = new Schema<TopicRecord>(
  {
    chapterId: {
      type: Schema.Types.ObjectId,
      ref: "Chapter",
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: TOPIC_NAME_MAX_LENGTH,
    },
    normalizedName: {
      type: String,
      required: true,
      maxlength: TOPIC_NAME_MAX_LENGTH,
    },
    integrityRevision: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

topicSchema.index(
  { chapterId: 1, normalizedName: 1 },
  {
    unique: true,
    name: "unique_topic_name_per_chapter",
    partialFilterExpression: { chapterId: { $type: "objectId" } },
  },
);

export const TopicModel =
  (models.Topic as Model<TopicRecord> | undefined) ??
  model<TopicRecord>("Topic", topicSchema);
