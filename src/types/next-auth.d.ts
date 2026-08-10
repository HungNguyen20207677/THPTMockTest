import "next-auth";
import "next-auth/jwt";

import type { UserRole } from "@/lib/constants/roles";

declare module "next-auth" {
  interface User {
    id: string;
    username: string;
    fullName: string;
    role: UserRole;
    sessionVersion: number;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      fullName: string;
      role: UserRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    fullName: string;
    role: UserRole;
    sessionVersion: number;
  }
}
