export const USER_ROLE = {
  ADMIN: "ADMIN",
  STUDENT: "STUDENT",
} as const;

export const USER_ROLES = [USER_ROLE.ADMIN, USER_ROLE.STUDENT] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_HOME = {
  [USER_ROLE.ADMIN]: "/admin",
  [USER_ROLE.STUDENT]: "/student",
} as const satisfies Record<UserRole, string>;
