import { describe, expect, it } from "vitest";

import { validateExamPdf } from "@/lib/cloudinary/exam-pdf";
import { EXAM_PDF_MAX_BYTES } from "@/lib/constants/exam";
import { getExamPdfValidationError } from "@/lib/validations/exam-pdf";

describe("exam PDF validation", () => {
  it("accepts a PDF MIME type, extension, size, and signature", async () => {
    const file = new File(["%PDF-1.7\nmock"], "de-thi.pdf", {
      type: "application/pdf",
    });

    await expect(validateExamPdf(file)).resolves.toBeUndefined();
  });

  it.each([
    {
      file: { name: "de-thi.txt", type: "application/pdf", size: 100 },
      message: "phần mở rộng",
    },
    {
      file: { name: "de-thi.pdf", type: "text/plain", size: 100 },
      message: "định dạng PDF",
    },
    {
      file: { name: "de-thi.pdf", type: "application/pdf", size: 0 },
      message: "không được để trống",
    },
    {
      file: {
        name: "de-thi.pdf",
        type: "application/pdf",
        size: EXAM_PDF_MAX_BYTES + 1,
      },
      message: "15 MB",
    },
  ])("rejects invalid metadata containing $message", ({ file, message }) => {
    expect(getExamPdfValidationError(file)).toContain(message);
  });

  it("rejects a file with a forged PDF MIME type", async () => {
    const file = new File(["not a PDF"], "de-thi.pdf", {
      type: "application/pdf",
    });

    await expect(validateExamPdf(file)).rejects.toMatchObject({
      code: "INVALID_EXAM_PDF",
      statusCode: 400,
    });
  });
});
