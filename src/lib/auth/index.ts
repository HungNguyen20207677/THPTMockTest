import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import {
  authenticateUser,
  findActiveAuthUser,
} from "@/lib/services/auth.service";
import { credentialsSchema } from "@/lib/validations/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsedCredentials = credentialsSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const user = await authenticateUser(parsedCredentials.data);

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          name: user.fullName,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.fullName = user.fullName;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;

        return token;
      }

      if (typeof token.id !== "string") {
        return null;
      }

      const currentUser = await findActiveAuthUser(token.id);

      if (!currentUser || currentUser.sessionVersion !== token.sessionVersion) {
        return null;
      }

      token.username = currentUser.username;
      token.fullName = currentUser.fullName;
      token.role = currentUser.role;

      return token;
    },
    session({ session, token }) {
      return {
        expires: session.expires,
        user: {
          id: token.id,
          username: token.username,
          fullName: token.fullName,
          role: token.role,
        },
      };
    },
  },
});
