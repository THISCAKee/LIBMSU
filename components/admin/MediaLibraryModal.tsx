"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type RefObject,
} from "react";
import { uniqueLibraryMedia } from "../../lib/adminView";
import type { AdminMediaItem, RowSlot } from "./types";
import styles from "./AdminStudio.module.css";

interface MediaLibraryModalProps {
  open: boolean;
  media: AdminMediaItem[];
  selectedKiosk: string;
  selectedRow: RowSlot;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onAdd: (url: string, type: "image" | "video") => void;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function MediaLibraryModal({
  open,
  media,
  selectedKiosk,
  selectedRow,
  triggerRef,
  onAdd,
  onClose,
}: MediaLibraryModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const uniqueMedia = useMemo(() => uniqueLibraryMedia(media), [media]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className={styles.modalBackdrop} onMouseDown={closeFromBackdrop}>
      <section
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-library-title"
      >
        <header className={styles.modalHeader}>
          <div>
            <p className={styles.eyebrow}>MEDIA LIBRARY</p>
            <h2 id="media-library-title">เลือกสื่อเดิม</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="ปิดคลังสื่อ"
          >
            ปิด
          </button>
        </header>

        <p className={styles.modalContext}>
          {selectedKiosk.toUpperCase()} · ROW {selectedRow}
        </p>

        <div className={styles.libraryGrid}>
          {uniqueMedia.map((item) => (
            <button
              key={item.url}
              type="button"
              className={styles.libraryItem}
              onClick={() => onAdd(item.url, item.type)}
            >
              <span className={styles.libraryPreview}>
                {item.type === "image" ? (
                  // Supabase library URLs are user-managed preview assets.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="ตัวอย่างสื่อในคลัง" />
                ) : (
                  <video src={item.url} muted preload="metadata" />
                )}
                <small>{item.type === "image" ? "IMAGE" : "VIDEO"}</small>
              </span>
              <span>เพิ่มลง Row {selectedRow}</span>
            </button>
          ))}
          {uniqueMedia.length === 0 && (
            <div className={styles.libraryEmpty}>
              <strong>ยังไม่มีสื่อในคลัง</strong>
              <span>อัปโหลดสื่อชิ้นแรกเพื่อให้เลือกใช้ซ้ำได้</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
