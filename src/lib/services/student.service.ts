import "server-only";

import { hash } from "bcryptjs";

import { USER_ROLE } from "@/lib/constants/roles";
import { PASSWORD_HASH_ROUNDS } from "@/lib/constants/user";
import { deleteExamAttemptRecordsByStudentId } from "@/lib/db/dao/exam-attempt.dao";
import { removeStudentFromExamAssignments } from "@/lib/db/dao/exam.dao";
import {
  createUser,
  deleteStudentUser,
  findUserById,
  findUserByUsername,
  listStudentUsers,
  updateStudentActiveStatus,
  updateStudentDetails,
  updateStudentPassword,
  type UserAccountRecord,
} from "@/lib/db/dao/user.dao";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import { withMongoTransaction } from "@/lib/db/mongoose";
import {
  DuplicateUsernameError,
  ForbiddenError,
  StudentNotFoundError,
} from "@/lib/errors/app-error";
import { normalizeUsername } from "@/lib/utils/username";
import type {
  CreateStudentInput,
  UpdateStudentInput,
} from "@/lib/validations/user";
import type { AppUser, StudentAccount } from "@/types/user";

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new ForbiddenError();
  }
}

function toStudentAccount(user: UserAccountRecord): StudentAccount {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function requireStudentTarget(
  actor: AppUser,
  studentId: string,
): Promise<UserAccountRecord> {
  assertAdmin(actor);

  if (actor.id === studentId) {
    throw new ForbiddenError("Không thể quản lý chính mình từ mục học sinh.");
  }

  const target = await findUserById(studentId);

  if (!target || target.role !== USER_ROLE.STUDENT) {
    throw new StudentNotFoundError();
  }

  return target;
}

export async function listStudents(actor: AppUser): Promise<StudentAccount[]> {
  assertAdmin(actor);
  const students = await listStudentUsers();
  return students.map(toStudentAccount);
}

export async function createStudent(
  actor: AppUser,
  input: CreateStudentInput,
): Promise<StudentAccount> {
  assertAdmin(actor);

  const username = normalizeUsername(input.username);
  const existingUser = await findUserByUsername(username);

  if (existingUser) {
    throw new DuplicateUsernameError();
  }

  const passwordHash = await hash(input.password, PASSWORD_HASH_ROUNDS);

  try {
    const user = await createUser({
      username,
      passwordHash,
      fullName: input.fullName.trim(),
      role: USER_ROLE.STUDENT,
      isActive: true,
    });

    return toStudentAccount(user);
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new DuplicateUsernameError();
    }

    throw error;
  }
}

export async function editStudent(
  actor: AppUser,
  studentId: string,
  input: UpdateStudentInput,
): Promise<StudentAccount> {
  await requireStudentTarget(actor, studentId);

  const username = normalizeUsername(input.username);
  const usernameOwner = await findUserByUsername(username);

  if (usernameOwner && usernameOwner.id !== studentId) {
    throw new DuplicateUsernameError();
  }

  try {
    const updatedStudent = await updateStudentDetails(studentId, {
      username,
      fullName: input.fullName.trim(),
    });

    if (!updatedStudent) {
      throw new StudentNotFoundError();
    }

    return toStudentAccount(updatedStudent);
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new DuplicateUsernameError();
    }

    throw error;
  }
}

export async function resetStudentPassword(
  actor: AppUser,
  studentId: string,
  password: string,
): Promise<void> {
  await requireStudentTarget(actor, studentId);

  const passwordHash = await hash(password, PASSWORD_HASH_ROUNDS);
  const updated = await updateStudentPassword(studentId, passwordHash);

  if (!updated) {
    throw new StudentNotFoundError();
  }
}

export async function setStudentActiveStatus(
  actor: AppUser,
  studentId: string,
  isActive: boolean,
): Promise<StudentAccount> {
  await requireStudentTarget(actor, studentId);

  const updatedStudent = await updateStudentActiveStatus(studentId, isActive);

  if (!updatedStudent) {
    throw new StudentNotFoundError();
  }

  return toStudentAccount(updatedStudent);
}

export async function deleteStudent(
  actor: AppUser,
  studentId: string,
): Promise<void> {
  await requireStudentTarget(actor, studentId);

  await withMongoTransaction(async (session) => {
    await deleteExamAttemptRecordsByStudentId(studentId, session);
    await removeStudentFromExamAssignments(studentId, session);
    const deleted = await deleteStudentUser(studentId, session);

    if (!deleted) {
      throw new StudentNotFoundError();
    }
  });
}
