import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiSignRequest: vi.fn(),
  resource: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("@/lib/cloudinary/client", () => ({
  getCloudinaryClient: () => ({
    utils: { api_sign_request: mocks.apiSignRequest },
    api: { resource: mocks.resource },
    uploader: { destroy: mocks.destroy },
  }),
}));

vi.mock("@/lib/env/server", () => ({
  getCloudinaryEnvironment: () => ({
    cloudName: "test-cloud",
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
  }),
}));

import {
  createEssayImageUploadTicket,
  deleteEssayImage,
  verifyEssayImageAsset,
  type EssayImageUploadScope,
} from "@/lib/cloudinary/essay-image";
import { ESSAY_IMAGE_MAX_BYTES } from "@/lib/constants/exam-attempt";
import { attachEssayImageRequestSchema } from "@/lib/validations/essay-image";
import type { EssayImageUploadReference } from "@/types/exam-attempt";

const now = new Date("2026-08-11T03:00:00.000Z");
const signature = "a".repeat(40);
const scope: EssayImageUploadScope = {
  studentId: "student-id",
  attemptId: "attempt-id",
  questionId: "essay-question",
};

function getScopeHash(targetScope = scope): string {
  return createHash("sha256")
    .update(targetScope.studentId)
    .update("\0")
    .update(targetScope.attemptId)
    .update("\0")
    .update(targetScope.questionId)
    .digest("hex");
}

function createReference(): EssayImageUploadReference {
  return {
    publicId: `thpt-mock-test/essay-images/${getScopeHash()}/123e4567-e89b-42d3-a456-426614174000`,
    originalFilename: "answer.jpg",
    timestamp: Math.floor(now.getTime() / 1000),
    signature,
  };
}

function createResource(reference = createReference()) {
  return {
    public_id: reference.publicId,
    resource_type: "image",
    type: "upload",
    bytes: 4096,
    secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1234567890/${reference.publicId}.jpg`,
    format: "jpg",
    width: 1200,
    height: 800,
  };
}

describe("essay image Cloudinary flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.apiSignRequest.mockReset();
    mocks.resource.mockReset();
    mocks.destroy.mockReset();
    mocks.apiSignRequest.mockReturnValue(signature);
    mocks.destroy.mockResolvedValue({ result: "ok" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a signed direct-upload ticket scoped to student, attempt, and question", () => {
    const ticket = createEssayImageUploadTicket(scope, {
      name: "answer.jpg",
      type: "image/jpeg",
      size: 4096,
    });

    expect(ticket.uploadUrl).toBe(
      "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
    );
    expect(ticket.apiKey).toBe("test-api-key");
    expect(ticket.fields).toMatchObject({
      timestamp: String(Math.floor(now.getTime() / 1000)),
      overwrite: "0",
      allowed_formats: "jpg,jpeg,png,webp",
      filename_override: "answer.jpg",
      type: "upload",
    });
    expect(ticket.fields.public_id).toMatch(
      new RegExp(
        `^thpt-mock-test/essay-images/${getScopeHash()}/[a-f\\d-]{36}$`,
      ),
    );
    expect(mocks.apiSignRequest).toHaveBeenCalledWith(
      ticket.fields,
      "test-api-secret",
    );
    expect(JSON.stringify(ticket)).not.toContain("test-api-secret");
  });

  it("persists only trusted metadata read from a verified Cloudinary image", async () => {
    const reference = createReference();
    mocks.resource.mockResolvedValue(createResource(reference));

    await expect(verifyEssayImageAsset(reference, scope)).resolves.toEqual({
      publicId: reference.publicId,
      secureUrl: createResource(reference).secure_url,
      originalFilename: "answer.jpg",
      bytes: 4096,
      format: "jpg",
      width: 1200,
      height: 800,
    });
    expect(mocks.resource).toHaveBeenCalledWith(reference.publicId, {
      resource_type: "image",
      type: "upload",
      timeout: 60_000,
    });
  });

  it("rejects a signed reference outside the expected ownership scope", async () => {
    await expect(
      verifyEssayImageAsset(createReference(), {
        ...scope,
        studentId: "another-student",
      }),
    ).rejects.toMatchObject({ code: "INVALID_ESSAY_IMAGE", statusCode: 400 });
    expect(mocks.resource).not.toHaveBeenCalled();
  });

  it("rejects tampered signatures and arbitrary client Cloudinary metadata", async () => {
    mocks.apiSignRequest.mockReturnValue("b".repeat(40));

    await expect(
      verifyEssayImageAsset(createReference(), scope),
    ).rejects.toMatchObject({ code: "INVALID_ESSAY_IMAGE", statusCode: 400 });
    expect(mocks.resource).not.toHaveBeenCalled();
    expect(
      attachEssayImageRequestSchema.safeParse({
        upload: createReference(),
        secureUrl: "https://attacker.example/image.jpg",
        bytes: 1,
        width: 1,
        height: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects wrong image types, unsafe URLs, and oversized resources", async () => {
    const reference = createReference();

    for (const resource of [
      { ...createResource(reference), format: "gif" },
      {
        ...createResource(reference),
        secure_url: "https://attacker.example/answer.jpg",
      },
      { ...createResource(reference), bytes: ESSAY_IMAGE_MAX_BYTES + 1 },
    ]) {
      mocks.resource.mockResolvedValueOnce(resource);
      await expect(
        verifyEssayImageAsset(reference, scope),
      ).rejects.toMatchObject({
        code: expect.stringMatching(
          /^(INVALID_ESSAY_IMAGE|ESSAY_IMAGE_TOO_LARGE)$/,
        ),
      });
    }
  });

  it("deletes an image as a Cloudinary image resource", async () => {
    const reference = createReference();

    await deleteEssayImage(reference.publicId);

    expect(mocks.destroy).toHaveBeenCalledWith(reference.publicId, {
      resource_type: "image",
      type: "upload",
      invalidate: true,
    });
  });

  it("treats an already-missing image as successfully deleted", async () => {
    mocks.destroy.mockResolvedValue({ result: "not found" });

    await expect(
      deleteEssayImage(createReference().publicId),
    ).resolves.toBeUndefined();
  });
});
