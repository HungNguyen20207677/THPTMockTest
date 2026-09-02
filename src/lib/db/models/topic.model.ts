import "server-only";

import { model, models, Schema, type Model } from "mongoose";

import { TOPIC_NAME_MAX_LENGTH } from "@/lib/constants/topic";

export interface TopicRecord {
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

const topicSchema = new Schema<TopicRecord>(
  {
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

topicSchema.index({ normalizedName: 1 }, { unique: true });

export const TopicModel =
  (models.Topic as Model<TopicRecord> | undefined) ??
  model<TopicRecord>("Topic", topicSchema);
