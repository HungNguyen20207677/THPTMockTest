/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminEssayImageViewer } from "@/components/admin/admin-essay-image-viewer";
import type { EssayImage } from "@/types/exam-attempt";

const images: EssayImage[] = [
  {
    publicId: "essay-image-1",
    secureUrl:
      "https://res.cloudinary.com/test/image/upload/v1/essay-image-1.jpg",
    originalFilename: "essay-answer-1.jpg",
    bytes: 1024,
    format: "jpg",
    width: 2400,
    height: 1600,
  },
  {
    publicId: "essay-image-2",
    secureUrl:
      "https://res.cloudinary.com/test/image/upload/v1/essay-image-2.png",
    originalFilename: "essay-answer-2.png",
    bytes: 2048,
    format: "png",
    width: 1600,
    height: 2400,
  },
];

afterEach(cleanup);

function openFirstImage() {
  const thumbnail = screen.getByRole("button", {
    name: "Phóng to ảnh bài làm 1",
  });

  fireEvent.click(thumbnail);
  return thumbnail as HTMLButtonElement;
}

describe("AdminEssayImageViewer", () => {
  it("opens from a non-submitting thumbnail and uses the persisted original URL", () => {
    render(<AdminEssayImageViewer images={images} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    const thumbnail = openFirstImage();

    expect(thumbnail.type).toBe("button");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen
        .getByRole("img", { name: "Ảnh bài làm phóng to 1" })
        .getAttribute("src"),
    ).toBe(images[0]?.secureUrl);
  });

  it("zooms in and out within bounds and restores fit", () => {
    render(<AdminEssayImageViewer images={images} />);
    openFirstImage();

    const zoomIn = screen.getByRole("button", { name: "Phóng to ảnh" });
    const zoomOut = screen.getByRole("button", { name: "Thu nhỏ ảnh" });
    const fit = screen.getByRole("button", { name: "Vừa màn hình" });
    const zoom = screen.getByLabelText("Mức thu phóng");

    expect(zoom.textContent).toBe("100%");
    expect((zoomOut as HTMLButtonElement).disabled).toBe(true);

    for (let index = 0; index < 20; index += 1) {
      fireEvent.click(zoomIn);
    }

    expect(zoom.textContent).toBe("400%");
    expect((zoomIn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(zoomOut);
    expect(zoom.textContent).toBe("375%");

    fireEvent.click(fit);
    expect(zoom.textContent).toBe("100%");
    expect((zoomOut as HTMLButtonElement).disabled).toBe(true);
    expect((fit as HTMLButtonElement).disabled).toBe(true);
  });

  it("navigates ordered images and resets zoom when the image changes", () => {
    render(<AdminEssayImageViewer images={images} />);
    openFirstImage();

    fireEvent.click(screen.getByRole("button", { name: "Phóng to ảnh" }));
    expect(screen.getByLabelText("Mức thu phóng").textContent).toBe("125%");

    fireEvent.click(
      screen.getByRole("button", { name: "Ảnh bài làm tiếp theo" }),
    );

    expect(screen.getByText("Ảnh 2 / 2")).toBeTruthy();
    expect(screen.getByLabelText("Mức thu phóng").textContent).toBe("100%");
    expect(
      screen
        .getByRole("img", { name: "Ảnh bài làm phóng to 2" })
        .getAttribute("src"),
    ).toBe(images[1]?.secureUrl);
    expect(
      (
        screen.getByRole("button", {
          name: "Ảnh bài làm tiếp theo",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Ảnh bài làm trước" }));
    expect(screen.getByText("Ảnh 1 / 2")).toBeTruthy();
  });

  it("disables both navigation controls for a single image", () => {
    render(<AdminEssayImageViewer images={[images[0]!]} />);
    openFirstImage();

    expect(
      (
        screen.getByRole("button", {
          name: "Ảnh bài làm trước",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Ảnh bài làm tiếp theo",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Ảnh 1 / 1")).toBeTruthy();
  });
});
