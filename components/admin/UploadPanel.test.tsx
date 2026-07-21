import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UploadPanel } from "./UploadPanel";

const baseProps = {
  selectedRow: 1 as const,
  visibleRows: [1, 2, 3] as (1 | 2 | 3)[],
  duration: 10,
  uploading: false,
  uploadProgress: 0,
  dragOver: false,
  dropZoneRef: createRef<HTMLDivElement>(),
  libraryTriggerRef: createRef<HTMLButtonElement>(),
  onFileChange: () => {},
  onDragOver: () => {},
  onDragLeave: () => {},
  onDrop: () => {},
  onClearFile: () => {},
  onSelectRow: () => {},
  onChangeDuration: () => {},
  onUpload: () => {},
  onOpenLibrary: () => {},
};

describe("UploadPanel", () => {
  it("shows image timing and all supplied Rows", () => {
    const file = new File(["image"], "poster.jpg", { type: "image/jpeg" });
    const html = renderToStaticMarkup(
      <UploadPanel {...baseProps} file={file} />,
    );

    expect(html).toContain("poster.jpg");
    expect(html).toContain("ระยะเวลาแสดงภาพ");
    expect(html).toContain("Row 3");
  });

  it("hides image timing for video and respects TV Row restrictions", () => {
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
    const html = renderToStaticMarkup(
      <UploadPanel {...baseProps} file={file} visibleRows={[1]} />,
    );

    expect(html).not.toContain("ระยะเวลาแสดงภาพ");
    expect(html).not.toContain("Row 2");
    expect(html).not.toContain("Row 3");
  });
});
