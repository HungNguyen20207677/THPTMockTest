import { describe, expect, it } from "vitest";

import { USER_ROLES } from "./roles";

describe("USER_ROLES", () => {
  it("contains the two supported application roles", () => {
    expect(USER_ROLES).toEqual(["ADMIN", "STUDENT"]);
  });
});
