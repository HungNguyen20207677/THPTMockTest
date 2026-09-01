import "server-only";

import type { ClientSession, Types } from "mongoose";

import { USER_ROLE, type UserRole } from "@/lib/constants/roles";
import { connectToDatabase } from "@/lib/db/mongoose";
import { UserModel } from "@/lib/db/models/user.model";

export interface UserIdentityRecord {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  sessionVersion: number;
}

export interface UserAccountRecord extends UserIdentityRecord {
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticationUserRecord extends UserIdentityRecord {
  passwordHash: string;
}

export interface CreateUserRecord {
  username: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

interface UserDocumentData {
  _id: Types.ObjectId;
  username: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

let userIndexesPromise: Promise<void> | null = null;

async function prepareUserModel(): Promise<void> {
  await connectToDatabase();

  if (!userIndexesPromise) {
    userIndexesPromise = UserModel.init()
      .then(() => undefined)
      .catch((error: unknown) => {
        userIndexesPromise = null;
        throw error;
      });
  }

  await userIndexesPromise;
}

function toUserIdentity(user: UserDocumentData): UserIdentityRecord {
  return {
    id: user._id.toString(),
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    sessionVersion: user.sessionVersion,
  };
}

function toUserAccount(user: UserDocumentData): UserAccountRecord {
  return {
    ...toUserIdentity(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findUserForAuthentication(
  username: string,
): Promise<AuthenticationUserRecord | null> {
  await prepareUserModel();

  const user = await UserModel.findOne({ username })
    .select(
      "_id username +passwordHash fullName role isActive +sessionVersion createdAt updatedAt",
    )
    .lean<UserDocumentData>()
    .exec();

  if (!user) {
    return null;
  }

  return {
    ...toUserIdentity(user),
    passwordHash: user.passwordHash,
  };
}

export async function findUserById(
  userId: string,
): Promise<UserAccountRecord | null> {
  await prepareUserModel();

  const user = await UserModel.findById(userId)
    .select(
      "_id username fullName role isActive +sessionVersion createdAt updatedAt",
    )
    .lean<UserDocumentData>()
    .exec();

  return user ? toUserAccount(user) : null;
}

export async function findUserByUsername(
  username: string,
): Promise<UserAccountRecord | null> {
  await prepareUserModel();

  const user = await UserModel.findOne({ username })
    .select(
      "_id username fullName role isActive +sessionVersion createdAt updatedAt",
    )
    .lean<UserDocumentData>()
    .exec();

  return user ? toUserAccount(user) : null;
}

export async function hasAdminUser(): Promise<boolean> {
  await prepareUserModel();
  return Boolean(await UserModel.exists({ role: USER_ROLE.ADMIN }));
}

export async function listStudentUsers(): Promise<UserAccountRecord[]> {
  await prepareUserModel();

  const users = await UserModel.find({ role: USER_ROLE.STUDENT })
    .select(
      "_id username fullName role isActive +sessionVersion createdAt updatedAt",
    )
    .sort({ createdAt: -1 })
    .lean<UserDocumentData[]>()
    .exec();

  return users.map(toUserAccount);
}

export async function findStudentUsersByIds(
  studentIds: string[],
): Promise<UserAccountRecord[]> {
  await prepareUserModel();

  if (studentIds.length === 0) {
    return [];
  }

  const users = await UserModel.find({
    _id: { $in: studentIds },
    role: USER_ROLE.STUDENT,
  })
    .select(
      "_id username fullName role isActive +sessionVersion createdAt updatedAt",
    )
    .lean<UserDocumentData[]>()
    .exec();

  return users.map(toUserAccount);
}

export async function reserveStudentsForExamAssignment(
  studentIds: string[],
  session: ClientSession,
): Promise<boolean> {
  await prepareUserModel();

  if (studentIds.length === 0) {
    return true;
  }

  const result = await UserModel.updateMany(
    {
      _id: { $in: studentIds },
      role: USER_ROLE.STUDENT,
    },
    { $inc: { assignmentOperationVersion: 1 } },
    { runValidators: true, session, timestamps: false },
  ).exec();

  return result.matchedCount === studentIds.length;
}

export async function countStudentUsers(): Promise<{
  total: number;
  active: number;
}> {
  await prepareUserModel();
  const [total, active] = await Promise.all([
    UserModel.countDocuments({ role: USER_ROLE.STUDENT }).exec(),
    UserModel.countDocuments({
      role: USER_ROLE.STUDENT,
      isActive: true,
    }).exec(),
  ]);

  return { total, active };
}

export async function createUser(
  input: CreateUserRecord,
): Promise<UserAccountRecord> {
  await prepareUserModel();

  const user = await UserModel.create(input);

  return {
    id: user._id.toString(),
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    sessionVersion: user.sessionVersion,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function updateStudentDetails(
  studentId: string,
  input: { username: string; fullName: string },
): Promise<UserAccountRecord | null> {
  await prepareUserModel();

  const user = await UserModel.findOneAndUpdate(
    { _id: studentId, role: USER_ROLE.STUDENT },
    { $set: input },
    { returnDocument: "after", runValidators: true },
  )
    .select(
      "_id username fullName role isActive +sessionVersion createdAt updatedAt",
    )
    .lean<UserDocumentData>()
    .exec();

  return user ? toUserAccount(user) : null;
}

export async function updateStudentPassword(
  studentId: string,
  passwordHash: string,
): Promise<boolean> {
  await prepareUserModel();

  const result = await UserModel.updateOne(
    { _id: studentId, role: USER_ROLE.STUDENT },
    { $set: { passwordHash }, $inc: { sessionVersion: 1 } },
    { runValidators: true },
  ).exec();

  return result.matchedCount === 1;
}

export async function updateStudentActiveStatus(
  studentId: string,
  isActive: boolean,
): Promise<UserAccountRecord | null> {
  await prepareUserModel();

  const user = await UserModel.findOneAndUpdate(
    { _id: studentId, role: USER_ROLE.STUDENT },
    { $set: { isActive }, $inc: { sessionVersion: 1 } },
    { returnDocument: "after", runValidators: true },
  )
    .select(
      "_id username fullName role isActive +sessionVersion createdAt updatedAt",
    )
    .lean<UserDocumentData>()
    .exec();

  return user ? toUserAccount(user) : null;
}

export async function markStudentAttemptsStarted(
  studentId: string,
): Promise<boolean> {
  await prepareUserModel();

  const result = await UserModel.updateOne(
    {
      _id: studentId,
      role: USER_ROLE.STUDENT,
      isActive: true,
    },
    { $set: { attemptsStarted: true } },
    { runValidators: true },
  ).exec();

  return result.matchedCount === 1;
}

export async function reserveStudentForAttemptCreation(
  studentId: string,
  session: ClientSession,
): Promise<boolean> {
  await prepareUserModel();

  const result = await UserModel.updateOne(
    {
      _id: studentId,
      role: USER_ROLE.STUDENT,
      isActive: true,
    },
    {
      $set: { attemptsStarted: true },
      $inc: { attemptOperationVersion: 1 },
    },
    { runValidators: true, session, timestamps: false },
  ).exec();

  return result.matchedCount === 1;
}

export async function deleteStudentUser(
  studentId: string,
  session: ClientSession,
): Promise<boolean> {
  await prepareUserModel();

  const result = await UserModel.deleteOne(
    { _id: studentId, role: USER_ROLE.STUDENT },
    { session },
  ).exec();

  return result.deletedCount === 1;
}
