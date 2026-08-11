import { describe, expect, it } from "vitest";

import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import {
  adminResultQuerySchema,
  paginationQuerySchema,
} from "@/lib/validations/reporting";

describe("reporting validation", () => {
  it("uses bounded pagination defaults", () => {
    expect(paginationQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    });
    expect(
      paginationQuerySchema.safeParse({ page: "1", pageSize: "101" }).success,
    ).toBe(false);
    expect(
      paginationQuerySchema.safeParse({ page: "10001", pageSize: "20" })
        .success,
    ).toBe(false);
  });

  it("accepts terminal filters and normalizes object IDs", () => {
    expect(
      adminResultQuerySchema.parse({
        page: "2",
        pageSize: "50",
        studentId: "507F191E810C19729DE860EA",
        examId: "507F1F77BCF86CD799439011",
        status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
      }),
    ).toEqual({
      page: 2,
      pageSize: 50,
      studentId: "507f191e810c19729de860ea",
      examId: "507f1f77bcf86cd799439011",
      status: EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED,
    });
  });

  it("rejects IN_PROGRESS as a result status", () => {
    expect(
      adminResultQuerySchema.safeParse({
        status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      }).success,
    ).toBe(false);
  });
});
