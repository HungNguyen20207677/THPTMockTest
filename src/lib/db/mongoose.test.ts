import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  endSession: vi.fn(),
  startSession: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: {
    connect: mocks.connect,
    disconnect: mocks.disconnect,
    startSession: mocks.startSession,
  },
}));

vi.mock("@/lib/env/server", () => ({
  getMongoDbUri: () => "mongodb://localhost/test?replicaSet=rs0",
}));

import { withMongoTransaction } from "@/lib/db/mongoose";

const session = {
  endSession: mocks.endSession,
  withTransaction: mocks.withTransaction,
};

describe("MongoDB transaction helper", () => {
  beforeEach(() => {
    mocks.connect.mockReset();
    mocks.connect.mockResolvedValue({ startSession: mocks.startSession });
    mocks.endSession.mockReset();
    mocks.endSession.mockResolvedValue(undefined);
    mocks.startSession.mockReset();
    mocks.startSession.mockResolvedValue(session);
    mocks.withTransaction.mockReset();
    mocks.withTransaction.mockImplementation(
      (operation: () => Promise<unknown>) => operation(),
    );
  });

  it("runs the operation through withTransaction and closes the session", async () => {
    const operation = vi.fn().mockResolvedValue("committed");

    await expect(withMongoTransaction(operation)).resolves.toBe("committed");
    expect(operation).toHaveBeenCalledWith(session);
    expect(mocks.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it("closes the session when transaction commit fails", async () => {
    mocks.withTransaction.mockImplementation(
      async (operation: () => Promise<unknown>) => {
        await operation();
        throw new Error("Commit failed");
      },
    );

    await expect(
      withMongoTransaction(() => Promise.resolve("not committed")),
    ).rejects.toThrow("Commit failed");
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });
});
