import "server-only";

import { Types, type ClientSession, type PipelineStage } from "mongoose";

import { TERMINAL_EXAM_ATTEMPT_STATUSES } from "@/lib/constants/exam-attempt";
import { EXAM_VISIBILITY_MODE } from "@/lib/constants/exam";
import { USER_ROLE, type UserRole } from "@/lib/constants/roles";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ExamAttemptModel } from "@/lib/db/models/exam-attempt.model";
import { UserModel } from "@/lib/db/models/user.model";
import type { ExamVisibilityMode } from "@/types/exam";

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

export interface ExamAssignmentCompletionPersistenceRow {
  studentId: string;
  username: string;
  fullName: string;
  isActive: boolean;
  completionStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  isOverdue: boolean;
  firstCompletion: {
    attemptId: string;
    attemptNumber: number;
    status: (typeof TERMINAL_EXAM_ATTEMPT_STATUSES)[number];
    submittedAt: Date;
  } | null;
}

export interface ExamAssignmentCompletionPersistencePage {
  students: ExamAssignmentCompletionPersistenceRow[];
  totals: {
    assigned: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    overdue: number;
  };
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

export async function getExamAssignmentCompletionPage(input: {
  examId: string;
  visibilityMode: ExamVisibilityMode;
  assignedStudentIds: string[];
  assignmentDueAt: Date | null;
  now: Date;
  page: number;
  pageSize: number;
}): Promise<ExamAssignmentCompletionPersistencePage> {
  await prepareUserModel();

  if (
    input.visibilityMode === EXAM_VISIBILITY_MODE.SELECTED_STUDENTS &&
    input.assignedStudentIds.length === 0
  ) {
    return {
      students: [],
      totals: {
        assigned: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        overdue: 0,
      },
    };
  }

  const match: Record<string, unknown> = { role: USER_ROLE.STUDENT };
  if (input.visibilityMode === EXAM_VISIBILITY_MODE.SELECTED_STUDENTS) {
    match._id = {
      $in: input.assignedStudentIds.map(
        (studentId) => new Types.ObjectId(studentId),
      ),
    };
  }

  const deadlinePassed = Boolean(
    input.assignmentDueAt &&
    input.now.getTime() > input.assignmentDueAt.getTime(),
  );
  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: ExamAttemptModel.collection.name,
        let: { rosterStudentId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$studentId", "$$rosterStudentId"] },
                  { $eq: ["$examId", new Types.ObjectId(input.examId)] },
                ],
              },
            },
          },
          { $sort: { submittedAt: 1, _id: 1 } },
          {
            $project: {
              status: 1,
              attemptNumber: 1,
              submittedAt: 1,
              expiresAt: 1,
            },
          },
        ],
        as: "assignmentAttempts",
      },
    },
    {
      $set: {
        terminalAttempts: {
          $filter: {
            input: "$assignmentAttempts",
            as: "attempt",
            cond: {
              $in: ["$$attempt.status", TERMINAL_EXAM_ATTEMPT_STATUSES],
            },
          },
        },
        activeAttempts: {
          $filter: {
            input: "$assignmentAttempts",
            as: "attempt",
            cond: {
              $and: [
                { $eq: ["$$attempt.status", "IN_PROGRESS"] },
                { $gt: ["$$attempt.expiresAt", input.now] },
              ],
            },
          },
        },
      },
    },
    {
      $set: {
        completionStatus: {
          $switch: {
            branches: [
              {
                case: { $gt: [{ $size: "$terminalAttempts" }, 0] },
                then: "COMPLETED",
              },
              {
                case: { $gt: [{ $size: "$activeAttempts" }, 0] },
                then: "IN_PROGRESS",
              },
            ],
            default: "NOT_STARTED",
          },
        },
        firstCompletion: { $arrayElemAt: ["$terminalAttempts", 0] },
        isOverdue: {
          $and: [deadlinePassed, { $eq: [{ $size: "$terminalAttempts" }, 0] }],
        },
      },
    },
    {
      $facet: {
        statistics: [
          {
            $group: {
              _id: null,
              assigned: { $sum: 1 },
              completed: {
                $sum: {
                  $cond: [{ $eq: ["$completionStatus", "COMPLETED"] }, 1, 0],
                },
              },
              inProgress: {
                $sum: {
                  $cond: [{ $eq: ["$completionStatus", "IN_PROGRESS"] }, 1, 0],
                },
              },
              notStarted: {
                $sum: {
                  $cond: [{ $eq: ["$completionStatus", "NOT_STARTED"] }, 1, 0],
                },
              },
              overdue: { $sum: { $cond: ["$isOverdue", 1, 0] } },
            },
          },
        ],
        students: [
          { $sort: { fullName: 1, username: 1, _id: 1 } },
          { $skip: (input.page - 1) * input.pageSize },
          { $limit: input.pageSize },
          {
            $project: {
              username: 1,
              fullName: 1,
              isActive: 1,
              completionStatus: 1,
              isOverdue: 1,
              firstCompletion: 1,
            },
          },
        ],
      },
    },
  ];

  interface AggregateResult {
    statistics: Array<ExamAssignmentCompletionPersistencePage["totals"]>;
    students: Array<{
      _id: Types.ObjectId;
      username: string;
      fullName: string;
      isActive: boolean;
      completionStatus: ExamAssignmentCompletionPersistenceRow["completionStatus"];
      isOverdue: boolean;
      firstCompletion?: {
        _id: Types.ObjectId;
        attemptNumber: number;
        status: (typeof TERMINAL_EXAM_ATTEMPT_STATUSES)[number];
        submittedAt: Date;
      };
    }>;
  }

  const [result] = await UserModel.aggregate<AggregateResult>(pipeline).exec();
  const totals = result?.statistics[0] ?? {
    assigned: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    overdue: 0,
  };

  return {
    totals,
    students: (result?.students ?? []).map((student) => ({
      studentId: student._id.toString(),
      username: student.username,
      fullName: student.fullName,
      isActive: student.isActive,
      completionStatus: student.completionStatus,
      isOverdue: student.isOverdue,
      firstCompletion: student.firstCompletion
        ? {
            attemptId: student.firstCompletion._id.toString(),
            attemptNumber: student.firstCompletion.attemptNumber,
            status: student.firstCompletion.status,
            submittedAt: student.firstCompletion.submittedAt,
          }
        : null,
    })),
  };
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
