import type {
  ChangeEvent,
  DragEvent,
  RefObject,
} from "react";
import type { RowSlot } from "./types";
import styles from "./AdminStudio.module.css";

interface UploadPanelProps {
  file: File | null;
  selectedRow: RowSlot;
  visibleRows: RowSlot[];
  duration: number;
  uploading: boolean;
  uploadProgress: number;
  dragOver: boolean;
  dropZoneRef: RefObject<HTMLDivElement | null>;
  libraryTriggerRef: RefObject<HTMLButtonElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onClearFile: () => void;
  onSelectRow: (row: RowSlot) => void;
  onChangeDuration: (duration: number) => void;
  onUpload: () => void;
  onOpenLibrary: () => void;
}

export function UploadPanel({
  file,
  selectedRow,
  visibleRows,
  duration,
  uploading,
  uploadProgress,
  dragOver,
  dropZoneRef,
  libraryTriggerRef,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onClearFile,
  onSelectRow,
  onChangeDuration,
  onUpload,
  onOpenLibrary,
}: UploadPanelProps) {
  const isVideo = file?.type.startsWith("video") ?? false;

  return (
    <aside className={styles.uploadPanel} aria-labelledby="add-media-title">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>ADD TO DISPLAY</p>
        <h2 id="add-media-title">เพิ่มสื่อ</h2>
        <p>เลือกไฟล์และตำแหน่งที่จะนำไปแสดง</p>
      </div>

      <div
        ref={dropZoneRef}
        className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          id="admin-file-input"
          className={styles.visuallyHidden}
          type="file"
          accept="image/*,video/*"
          onChange={onFileChange}
        />
        {file ? (
          <div className={styles.selectedFile}>
            <span className={styles.fileType} aria-hidden="true">
              {isVideo ? "VID" : "IMG"}
            </span>
            <div>
              <strong>{file.name}</strong>
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <button type="button" onClick={onClearFile}>
              เอาออก
            </button>
          </div>
        ) : (
          <label htmlFor="admin-file-input" className={styles.filePicker}>
            <span className={styles.addGlyph} aria-hidden="true">+</span>
            <strong>วางไฟล์ที่นี่</strong>
            <span>หรือเลือกจากอุปกรณ์</span>
            <small>JPG, PNG, GIF, MP4, MOV</small>
          </label>
        )}
      </div>

      <fieldset className={styles.fieldGroup}>
        <legend>แสดงใน Row</legend>
        <div className={styles.segmentedControl}>
          {visibleRows.map((row) => (
            <button
              key={row}
              type="button"
              aria-pressed={selectedRow === row}
              onClick={() => onSelectRow(row)}
            >
              Row {row}
            </button>
          ))}
        </div>
      </fieldset>

      {!isVideo && (
        <div className={styles.fieldGroup}>
          <label htmlFor="media-duration">ระยะเวลาแสดงภาพ</label>
          <div className={styles.stepper}>
            <button
              type="button"
              aria-label="ลดเวลาแสดงภาพ"
              onClick={() => onChangeDuration(Math.max(3, duration - 1))}
            >
              −
            </button>
            <output id="media-duration">{duration} วินาที</output>
            <button
              type="button"
              aria-label="เพิ่มเวลาแสดงภาพ"
              onClick={() => onChangeDuration(Math.min(60, duration + 1))}
            >
              +
            </button>
          </div>
        </div>
      )}

      <button
        className={styles.primaryButton}
        type="button"
        disabled={!file || uploading}
        onClick={onUpload}
      >
        {uploading ? `กำลังเพิ่ม ${uploadProgress}%` : "เพิ่มสื่อ"}
      </button>
      {uploading && (
        <progress
          className={styles.progress}
          max="100"
          value={uploadProgress}
          aria-label="ความคืบหน้าการอัปโหลด"
        />
      )}

      <div className={styles.libraryDivider}><span>หรือ</span></div>
      <button
        ref={libraryTriggerRef}
        className={styles.secondaryButton}
        type="button"
        onClick={onOpenLibrary}
      >
        เลือกจากคลังสื่อ
      </button>
    </aside>
  );
}
