// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flush: vi.fn(),
  fetchStudentExamAttempt: vi.fn(),
  isDocumentElementFullscreen: vi.fn(),
  pause: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  resume: vi.fn(),
  submitStudentExamAttempt: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

vi.mock("@/components/exam/countdown-timer", () => ({
  CountdownTimer: () => <span data-testid="countdown">01:30:00</span>,
}));

vi.mock("@/hooks/use-attempt-autosave", () => ({
  AUTOSAVE_STATUS: {
    SAVED: "SAVED",
    UNSAVED: "UNSAVED",
    SAVING: "SAVING",
    ERROR: "ERROR",
  },
  useAttemptAutosave: () => ({
    status: "SAVED",
    flush: mocks.flush,
    pause: mocks.pause,
    resume: mocks.resume,
  }),
}));

vi.mock("@/lib/fullscreen", () => ({
  exitDocumentFullscreen: vi.fn(),
  isDocumentElementFullscreen: mocks.isDocumentElementFullscreen,
  isFullscreenSupported: vi.fn(() => true),
  requestDocumentFullscreen: vi.fn(),
}));

vi.mock("@/lib/api/student-exams", () => ({
  fetchStudentExamAttempt: mocks.fetchStudentExamAttempt,
  finalizeStudentExamAttempt: vi.fn(),
  removeStudentEssayImage: vi.fn(),
  saveStudentExamAttemptAnswers: vi.fn(),
  setStudentExamAttemptQuestionFlag: vi.fn(),
  submitStudentExamAttempt: mocks.submitStudentExamAttempt,
  uploadStudentEssayImage: vi.fn(),
}));

import {
  ActiveAttemptWorkspace,
  AttemptWorkspace,
} from "@/components/student/attempt-workspace";
import {
  EXAM_ATTEMPT_MODE,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
import { PART3_INPUT_MODE } from "@/lib/constants/exam";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import type { StudentExamAttemptContext } from "@/types/exam-attempt";

function createContext(
  mode: (typeof EXAM_ATTEMPT_MODE)[keyof typeof EXAM_ATTEMPT_MODE],
): StudentExamAttemptContext {
  return {
    exam: {
      id: "exam-id",
      title: "Đề Toán",
      pdf: { url: "https://example.com/exam.pdf", filename: "exam.pdf" },
      durationMinutes: 90,
      part3InputMode: PART3_INPUT_MODE.BUBBLE,
      shortAnswerInputMode: PART3_INPUT_MODE.BUBBLE,
      structureSnapshot: {
        sections: [
          {
            id: "section",
            title: "Phần trắc nghiệm",
            questions: [
              {
                id: "choice",
                type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
                maxScoreHundredths: 1000,
              },
            ],
          },
        ],
      },
    },
    attempt: {
      id: "attempt-id",
      examId: "exam-id",
      mode,
      attemptNumber: 1,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      answerRevision: 2,
      flaggedQuestionIds: [],
      startedAt: "2026-11-21T01:00:00.000Z",
      expiresAt:
        mode === EXAM_ATTEMPT_MODE.MOCK ? "2026-11-21T02:30:00.000Z" : null,
      answers: { answersByQuestionId: { choice: "B" } },
      lastSavedAt: "2026-11-21T01:05:00.000Z",
    },
    serverNow: "2026-11-21T01:10:00.000Z",
    canEditAnswers: true,
  };
}

describe("Attempt workspace modes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.flush.mockResolvedValue(undefined);
    mocks.isDocumentElementFullscreen.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("preserves Mock countdown and fullscreen behavior despite a forged query mode", () => {
    window.history.replaceState({}, "", "/attempt?mode=PRACTICE");
    render(<ActiveAttemptWorkspace initialContext={createContext("MOCK")} />);

    expect(screen.getByTestId("countdown")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Mở chế độ toàn màn hình" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Nộp bài/ })).toBeTruthy();
    expect(screen.queryByText("Chế độ luyện tập")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu và thoát" })).toBeNull();
  });

  it("hides countdown and fullscreen controls in server-authoritative Practice", () => {
    render(
      <ActiveAttemptWorkspace initialContext={createContext("PRACTICE")} />,
    );

    expect(screen.getByText("Chế độ luyện tập")).toBeTruthy();
    expect(screen.queryByTestId("countdown")).toBeNull();
    expect(screen.queryByRole("button", { name: /toàn màn hình/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Lưu và thoát" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Kết thúc luyện tập/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "B" }).checked,
    ).toBe(true);
  });

  it("preserves Mock fullscreen-exit submission", async () => {
    const context = createContext("MOCK");
    mocks.isDocumentElementFullscreen.mockReturnValue(true);
    mocks.submitStudentExamAttempt.mockResolvedValue({
      data: {
        attempt: {
          ...context.attempt,
          status: EXAM_ATTEMPT_STATUS.SUBMITTED,
          submittedAt: "2026-11-21T01:15:00.000Z",
        },
        serverNow: "2026-11-21T01:15:00.000Z",
        canEditAnswers: false,
      },
    });
    render(<ActiveAttemptWorkspace initialContext={context} />);

    mocks.isDocumentElementFullscreen.mockReturnValue(false);
    fireEvent(document, new Event("fullscreenchange"));

    await waitFor(() =>
      expect(mocks.submitStudentExamAttempt).toHaveBeenCalledOnce(),
    );
    expect(mocks.replace).toHaveBeenCalledWith(
      "/student/exams/exam-id/attempts/attempt-id/result",
    );
  });

  it("flushes pending autosave and exits Practice without submission", async () => {
    render(
      <ActiveAttemptWorkspace initialContext={createContext("PRACTICE")} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Lưu và thoát" }));

    await waitFor(() => expect(mocks.flush).toHaveBeenCalledOnce());
    expect(mocks.push).toHaveBeenCalledWith("/student");
    expect(mocks.submitStudentExamAttempt).not.toHaveBeenCalled();

    fireEvent(document, new Event("fullscreenchange"));
    expect(mocks.submitStudentExamAttempt).not.toHaveBeenCalled();
  });

  it("uses the existing confirmed submission flow to end Practice", async () => {
    const context = createContext("PRACTICE");
    mocks.submitStudentExamAttempt.mockResolvedValue({
      data: {
        attempt: {
          ...context.attempt,
          status: EXAM_ATTEMPT_STATUS.SUBMITTED,
          submittedAt: "2026-11-21T01:15:00.000Z",
        },
        serverNow: "2026-11-21T01:15:00.000Z",
        canEditAnswers: false,
      },
    });
    render(<ActiveAttemptWorkspace initialContext={context} />);

    fireEvent.click(screen.getByRole("button", { name: /Kết thúc luyện tập/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Xác nhận kết thúc" }),
    );

    await waitFor(() =>
      expect(mocks.submitStudentExamAttempt).toHaveBeenCalledWith(
        "exam-id",
        "attempt-id",
        context.attempt.answers,
        context.attempt.answerRevision,
      ),
    );
    expect(mocks.flush).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith("/student");
    expect(mocks.replace).not.toHaveBeenCalledWith(
      expect.stringContaining("result"),
    );
  });

  it("does not expose a Practice result link after termination", async () => {
    const context = createContext("PRACTICE");
    mocks.fetchStudentExamAttempt.mockResolvedValue({
      data: {
        context: {
          ...context,
          attempt: {
            ...context.attempt,
            status: EXAM_ATTEMPT_STATUS.SUBMITTED,
            submittedAt: "2026-11-21T01:15:00.000Z",
          },
          canEditAnswers: false,
        },
      },
    });

    render(<AttemptWorkspace examId="exam-id" attemptId="attempt-id" />);

    expect(await screen.findByText("CHẾ ĐỘ LUYỆN TẬP")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Xem kết quả" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Quay lại danh sách đề thi" }),
    ).toBeTruthy();
  });
});
