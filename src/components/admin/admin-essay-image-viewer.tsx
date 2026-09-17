"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EssayImage } from "@/types/exam-attempt";

const MIN_ZOOM = 100;
const MAX_ZOOM = 400;
const ZOOM_STEP = 25;

export function AdminEssayImageViewer({ images }: { images: EssayImage[] }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeImage = images[activeIndex] ?? images[0];

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "+") {
        event.preventDefault();
        setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP));
      } else if (event.key === "-") {
        event.preventDefault();
        setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!activeImage) return null;

  function openImage(index: number) {
    setActiveIndex(index);
    setZoom(MIN_ZOOM);
    setOpen(true);
  }

  function showImage(index: number) {
    setActiveIndex(index);
    setZoom(MIN_ZOOM);
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {images.map((image, imageIndex) => (
          <figure
            key={image.publicId}
            className="border-border overflow-hidden rounded-lg border"
          >
            <button
              ref={(element) => {
                thumbnailRefs.current[imageIndex] = element;
              }}
              type="button"
              className="group focus-visible:ring-ring relative block w-full cursor-zoom-in overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-inset"
              aria-label={`Phóng to ảnh bài làm ${imageIndex + 1}`}
              title={`Phóng to ảnh bài làm ${imageIndex + 1}`}
              onClick={() => openImage(imageIndex)}
            >
              <Image
                src={image.secureUrl}
                alt={`Ảnh bài làm ${imageIndex + 1}`}
                width={image.width}
                height={image.height}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="h-72 w-full object-contain transition-[filter,transform] group-hover:scale-[1.01] group-hover:brightness-95 lg:h-96"
              />
              <span className="bg-background/90 text-foreground pointer-events-none absolute right-2 bottom-2 rounded-md px-2 py-1 text-xs font-medium opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Phóng to
              </span>
            </button>
            <figcaption className="text-muted-foreground truncate px-3 py-2 text-xs">
              {image.originalFilename}
            </figcaption>
          </figure>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="h-[95dvh] w-[95vw] max-w-[95vw] grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden p-3 sm:p-4"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            thumbnailRefs.current[activeIndex]?.focus();
          }}
        >
          <DialogHeader className="min-w-0 pr-10 text-left">
            <DialogTitle>Xem ảnh bài làm</DialogTitle>
            <DialogDescription className="truncate">
              {activeImage.originalFilename}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Ảnh bài làm trước"
                title="Ảnh bài làm trước"
                disabled={activeIndex === 0}
                onClick={() => showImage(activeIndex - 1)}
              >
                <span aria-hidden="true">&lt;</span>
              </Button>
              <span
                className="min-w-20 text-center text-sm font-medium tabular-nums"
                aria-live="polite"
              >
                Ảnh {activeIndex + 1} / {images.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Ảnh bài làm tiếp theo"
                title="Ảnh bài làm tiếp theo"
                disabled={activeIndex === images.length - 1}
                onClick={() => showImage(activeIndex + 1)}
              >
                <span aria-hidden="true">&gt;</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Thu nhỏ ảnh"
                title="Thu nhỏ ảnh"
                disabled={zoom === MIN_ZOOM}
                onClick={() =>
                  setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))
                }
              >
                <span aria-hidden="true">-</span>
              </Button>
              <output
                className="min-w-14 text-center text-sm font-medium tabular-nums"
                aria-label="Mức thu phóng"
                aria-live="polite"
              >
                {zoom}%
              </output>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Phóng to ảnh"
                title="Phóng to ảnh"
                disabled={zoom === MAX_ZOOM}
                onClick={() =>
                  setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))
                }
              >
                <span aria-hidden="true">+</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={zoom === MIN_ZOOM}
                onClick={() => setZoom(MIN_ZOOM)}
              >
                Vừa màn hình
              </Button>
            </div>
          </div>

          <div
            className="min-h-0 overflow-auto overscroll-contain rounded-md bg-neutral-950"
            data-testid="admin-essay-image-viewport"
          >
            <div
              className="flex items-center justify-center"
              style={{ width: `${zoom}%`, height: `${zoom}%` }}
            >
              <Image
                key={activeImage.publicId}
                unoptimized
                src={activeImage.secureUrl}
                alt={`Ảnh bài làm phóng to ${activeIndex + 1}`}
                width={activeImage.width}
                height={activeImage.height}
                draggable={false}
                className="h-full w-full object-contain select-none"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
