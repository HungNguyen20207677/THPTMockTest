import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DynamicAnswerSheet } from "@/components/student/attempt-workspace";
import { PART3_INPUT_MODE } from "@/lib/constants/exam";
import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import { getDynamicAttemptAnswerProgress } from "@/lib/exam/attempt-answers";
import type { DynamicAttemptAnswers } from "@/types/exam-attempt";
import type { ExamStructureSnapshot } from "@/types/exam-structure-template";

const structure: ExamStructureSnapshot = {
  sections: [
    {
      id: "mixed",
      title: "Phần hỗn hợp",
      questions: [
        {
          id: "choice",
          type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
          maxScoreHundredths: 500,
        },
        {
          id: "essay",
          type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
          maxScoreHundredths: 500,
        },
      ],
    },
  ],
};

function renderWorkspaceAnswers(answers: DynamicAttemptAnswers): string {
  return renderToStaticMarkup(
    <DynamicAnswerSheet
      structure={structure}
      answers={answers}
      updateAnswer={vi.fn()}
      disabled={false}
      progress={getDynamicAttemptAnswerProgress(answers, structure)}
      shortAnswerInputMode={PART3_INPUT_MODE.BUBBLE}
      onShortAnswerTextValidityChange={vi.fn()}
      onEssayImageUpload={vi.fn()}
      onEssayImageRemove={vi.fn()}
      onFilePickerOpen={vi.fn()}
      onFilePickerReturn={vi.fn()}
    />,
  );
}

describe("dynamic ESSAY_IMAGE workspace", () => {
  it("renders essay controls in structure order without changing objective controls", () => {
    const markup = renderWorkspaceAnswers({
      answersByQuestionId: {
        choice: null,
        essay: { type: "ESSAY_IMAGE", images: [] },
      },
    });

    expect(markup.indexOf("Trắc nghiệm nhiều lựa chọn")).toBeLessThan(
      markup.indexOf("Tự luận bằng hình ảnh"),
    );
    expect(markup).toContain("Tải ảnh bài làm");
    expect(markup).toContain("Tối đa 5 ảnh");
    expect(markup).toContain("5,00 điểm");
    expect(markup).toContain('accept="image/jpeg,image/png,image/webp"');
  });

  it("renders persisted images from resumed attempt data", () => {
    const markup = renderWorkspaceAnswers({
      answersByQuestionId: {
        choice: null,
        essay: {
          type: "ESSAY_IMAGE",
          images: [
            {
              publicId: "essay-image",
              secureUrl:
                "https://res.cloudinary.com/test/image/upload/v1/essay-image.jpg",
              originalFilename: "bai-lam.jpg",
              bytes: 1024,
              format: "jpg",
              width: 1200,
              height: 800,
            },
          ],
        },
      },
    });

    expect(markup).toContain("bai-lam.jpg");
    expect(markup).toContain("Ảnh bài làm 1");
    expect(markup).toContain("Xóa ảnh");
  });
});
