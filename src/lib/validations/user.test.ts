import { describe, expect, it } from "vitest";

import { credentialsSchema } from "@/lib/validations/auth";
import {
  createStudentSchema,
  resetStudentPasswordSchema,
  studentIdSchema,
} from "@/lib/validations/user";

describe("user validation", () => {
  it("trims and normalizes usernames to lowercase", () => {
    const credentials = credentialsSchema.parse({
      username: "  Student.One  ",
      password: "matkhau123",
    });

    expect(credentials.username).toBe("student.one");
  });

  it("rejects student passwords shorter than eight characters", () => {
    const result = createStudentSchema.safeParse({
      fullName: "Nguyen Van An",
      username: "nguyenvanan",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("normalizes MongoDB ids and rejects mismatched password confirmation", () => {
    const id = "ABCDEF123456ABCDEF123456";
    const passwordResult = resetStudentPasswordSchema.safeParse({
      password: "matkhau123",
      confirmPassword: "matkhau456",
    });

    expect(studentIdSchema.parse(id)).toBe("abcdef123456abcdef123456");
    expect(passwordResult.success).toBe(false);
  });
});
