import "server-only";

import { model, models, Schema, type Model } from "mongoose";

import { USER_ROLE, USER_ROLES, type UserRole } from "@/lib/constants/roles";
import {
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from "@/lib/constants/user";

export interface UserRecord {
  username: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  sessionVersion: number;
  attemptsStarted: boolean;
  attemptOperationVersion: number;
  assignmentOperationVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserRecord>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: USERNAME_MIN_LENGTH,
      maxlength: USERNAME_MAX_LENGTH,
      match: USERNAME_PATTERN,
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: FULL_NAME_MIN_LENGTH,
      maxlength: FULL_NAME_MAX_LENGTH,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    sessionVersion: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
      select: false,
    },
    attemptsStarted: {
      type: Boolean,
      default: false,
      required: true,
      select: false,
    },
    attemptOperationVersion: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
      select: false,
    },
    assignmentOperationVersion: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index(
  { role: 1 },
  {
    unique: true,
    partialFilterExpression: { role: USER_ROLE.ADMIN },
    name: "unique_initial_admin",
  },
);

export const UserModel =
  (models.User as Model<UserRecord> | undefined) ??
  model<UserRecord>("User", userSchema);
