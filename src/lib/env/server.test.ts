import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCloudinaryEnvironment,
  getMongoDbUri,
  getOptionalAuthEnvironment,
} from "@/lib/env/server";

describe("server environment validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts supported MongoDB URI schemes and rejects unrelated URLs", () => {
    vi.stubEnv("MONGODB_URI", "mongodb+srv://example.invalid/app");
    expect(getMongoDbUri()).toBe("mongodb+srv://example.invalid/app");

    vi.stubEnv("MONGODB_URI", "https://example.invalid/database");
    expect(() => getMongoDbUri()).toThrow("MONGODB_URI");
  });

  it("rejects committed Cloudinary placeholder values", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "replace-with-cloud-name");
    vi.stubEnv("CLOUDINARY_API_KEY", "123456");
    vi.stubEnv("CLOUDINARY_API_SECRET", "secret-value");

    expect(() => getCloudinaryEnvironment()).toThrow("CLOUDINARY_CLOUD_NAME");
  });

  it("parses AUTH_TRUST_HOST as a real boolean and validates secret quality", () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(32));
    vi.stubEnv("AUTH_TRUST_HOST", "false");
    expect(getOptionalAuthEnvironment()).toEqual({
      secret: "a".repeat(32),
      trustHost: false,
    });

    vi.stubEnv("AUTH_TRUST_HOST", "yes");
    expect(() => getOptionalAuthEnvironment()).toThrow("AUTH_TRUST_HOST");

    vi.stubEnv("AUTH_SECRET", "   ");
    vi.stubEnv("AUTH_TRUST_HOST", "true");
    expect(() => getOptionalAuthEnvironment()).toThrow("AUTH_SECRET");
  });
});
