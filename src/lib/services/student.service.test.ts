import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hash: vi.fn(),
  createUser: vi.fn(),
  deleteExamAttemptRecordsByStudentId: vi.fn(),
  deleteExamRecord: vi.fn(),
  deleteStudentUser: vi.fn(),
  findUserById: vi.fn(),
  findUserByUsername: vi.fn(),
  listStudentUsers: vi.fn(),
  updateStudentActiveStatus: vi.fn(),
  updateStudentDetails: vi.fn(),
  updateStudentPassword: vi.fn(),
  transactionSession: { id: "transaction-session" },
  withMongoTransaction: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  hash: mocks.hash,
}));

vi.mock("@/lib/db/dao/exam-attempt.dao", () => ({
  deleteExamAttemptRecordsByStudentId:
    mocks.deleteExamAttemptRecordsByStudentId,
}));

vi.mock("@/lib/db/dao/user.dao", () => ({
  createUser: mocks.createUser,
  deleteStudentUser: mocks.deleteStudentUser,
  findUserById: mocks.findUserById,
  findUserByUsername: mocks.findUserByUsername,
  listStudentUsers: mocks.listStudentUsers,
  updateStudentActiveStatus: mocks.updateStudentActiveStatus,
  updateStudentDetails: mocks.updateStudentDetails,
  updateStudentPassword: mocks.updateStudentPassword,
}));

vi.mock("@/lib/db/dao/exam.dao", () => ({
  deleteExamRecord: mocks.deleteExamRecord,
}));

vi.mock("@/lib/db/mongoose", () => ({
  withMongoTransaction: mocks.withMongoTransaction,
}));

import { USER_ROLE } from "@/lib/constants/roles";
import {
  createStudent,
  deleteStudent,
  listStudents,
} from "@/lib/services/student.service";
import type { AppUser } from "@/types/user";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

const admin: AppUser = {
  id: "admin-id",
  username: "admin",
  fullName: "Quan Tri Vien",
  role: USER_ROLE.ADMIN,
};

const studentActor: AppUser = {
  id: "student-actor-id",
  username: "student-actor",
  fullName: "Hoc Sinh",
  role: USER_ROLE.STUDENT,
};

describe("student service", () => {
  beforeEach(() => {
    mocks.hash.mockReset();
    mocks.createUser.mockReset();
    mocks.deleteExamAttemptRecordsByStudentId.mockReset();
    mocks.deleteExamAttemptRecordsByStudentId.mockResolvedValue(0);
    mocks.deleteExamRecord.mockReset();
    mocks.deleteStudentUser.mockReset();
    mocks.findUserById.mockReset();
    mocks.findUserByUsername.mockReset();
    mocks.listStudentUsers.mockReset();
    mocks.updateStudentActiveStatus.mockReset();
    mocks.updateStudentDetails.mockReset();
    mocks.updateStudentPassword.mockReset();

    mocks.hash.mockResolvedValue("hashed-password");
    mocks.withMongoTransaction.mockReset();
    mocks.withMongoTransaction.mockImplementation(
      (operation: (session: unknown) => Promise<unknown>) =>
        operation(mocks.transactionSession),
    );
  });

  it("allows an ADMIN to create a STUDENT with a hashed password", async () => {
    mocks.findUserByUsername.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({
      id: "new-student-id",
      username: "student.one",
      fullName: "Nguyen Van An",
      role: USER_ROLE.STUDENT,
      isActive: true,
      createdAt,
      updatedAt,
    });

    const result = await createStudent(admin, {
      fullName: "Nguyen Van An",
      username: " Student.One ",
      password: "matkhau123",
    });

    expect(mocks.hash).toHaveBeenCalledWith("matkhau123", 12);
    expect(mocks.createUser).toHaveBeenCalledWith({
      username: "student.one",
      passwordHash: "hashed-password",
      fullName: "Nguyen Van An",
      role: USER_ROLE.STUDENT,
      isActive: true,
    });
    expect(mocks.createUser).not.toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: "matkhau123" }),
    );
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("rejects a duplicate username before hashing", async () => {
    mocks.findUserByUsername.mockResolvedValue({
      id: "existing-id",
      username: "student.one",
      fullName: "Existing Student",
      role: USER_ROLE.STUDENT,
      isActive: true,
      createdAt,
      updatedAt,
    });

    await expect(
      createStudent(admin, {
        fullName: "Nguyen Van An",
        username: "student.one",
        password: "matkhau123",
      }),
    ).rejects.toMatchObject({
      code: "USERNAME_EXISTS",
      statusCode: 409,
    });
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("rejects student-management access from a non-admin", async () => {
    await expect(listStudents(studentActor)).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(mocks.listStudentUsers).not.toHaveBeenCalled();
  });

  it("does not allow student-management logic to target an ADMIN", async () => {
    mocks.findUserById.mockResolvedValue({
      id: "another-admin-id",
      username: "admin-two",
      fullName: "Another Admin",
      role: USER_ROLE.ADMIN,
      isActive: true,
      createdAt,
      updatedAt,
    });

    await expect(
      deleteStudent(admin, "another-admin-id"),
    ).rejects.toMatchObject({
      code: "STUDENT_NOT_FOUND",
      statusCode: 404,
    });
    expect(mocks.deleteStudentUser).not.toHaveBeenCalled();
  });

  it("cascades a Student's ExamAttempts before deleting the account", async () => {
    mocks.findUserById.mockResolvedValue({
      id: "student-id",
      username: "student-one",
      fullName: "Nguyen Van An",
      role: USER_ROLE.STUDENT,
      isActive: true,
      createdAt,
      updatedAt,
    });
    mocks.deleteExamAttemptRecordsByStudentId.mockResolvedValue(2);
    mocks.deleteStudentUser.mockResolvedValue(true);

    await deleteStudent(admin, "student-id");

    expect(mocks.deleteExamAttemptRecordsByStudentId).toHaveBeenCalledWith(
      "student-id",
      mocks.transactionSession,
    );
    expect(mocks.deleteStudentUser).toHaveBeenCalledWith(
      "student-id",
      mocks.transactionSession,
    );
    expect(
      mocks.deleteExamAttemptRecordsByStudentId.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.deleteStudentUser.mock.invocationCallOrder[0]);
  });

  it("does not change Exams when deleting a Student", async () => {
    mocks.findUserById.mockResolvedValue({
      id: "student-id",
      username: "student-one",
      fullName: "Nguyen Van An",
      role: USER_ROLE.STUDENT,
      isActive: true,
      createdAt,
      updatedAt,
    });
    mocks.deleteStudentUser.mockResolvedValue(true);

    await deleteStudent(admin, "student-id");

    expect(mocks.deleteExamRecord).not.toHaveBeenCalled();
    expect(mocks.withMongoTransaction).toHaveBeenCalledOnce();
  });

  it("does not leave partially deleted Student data when the transaction fails", async () => {
    const databaseState = {
      studentExists: true,
      attemptIds: ["in-progress-attempt", "submitted-attempt"],
    };
    mocks.findUserById.mockResolvedValue({
      id: "student-id",
      username: "student-one",
      fullName: "Nguyen Van An",
      role: USER_ROLE.STUDENT,
      isActive: true,
      createdAt,
      updatedAt,
    });
    mocks.deleteExamAttemptRecordsByStudentId.mockImplementation(async () => {
      databaseState.attemptIds = [];
      return 2;
    });
    mocks.deleteStudentUser.mockRejectedValue(new Error("User delete failed"));
    mocks.withMongoTransaction.mockImplementation(
      async (operation: (session: unknown) => Promise<unknown>) => {
        const snapshot = structuredClone(databaseState);

        try {
          return await operation(mocks.transactionSession);
        } catch (error) {
          databaseState.studentExists = snapshot.studentExists;
          databaseState.attemptIds = snapshot.attemptIds;
          throw error;
        }
      },
    );

    await expect(deleteStudent(admin, "student-id")).rejects.toThrow(
      "User delete failed",
    );
    expect(databaseState).toEqual({
      studentExists: true,
      attemptIds: ["in-progress-attempt", "submitted-attempt"],
    });
  });
});
