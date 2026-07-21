"use client";

import { useState, type DragEvent } from "react";
import { formatOrderNumber } from "../../lib/adminView";
import type { AdminMediaItem, ModeFilter, RowSlot } from "./types";
import styles from "./AdminStudio.module.css";

interface MediaCardProps {
  item: AdminMediaItem;
  orderIndex: number;
  isTvKiosk: boolean;
  visibleRows: RowSlot[];
  isDragging: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onUpdateDuration: (id: number, duration: number) => void;
  onToggleActive: (id: number, current: boolean) => void;
  onUpdateModeFilter: (id: number, current: ModeFilter) => void;
  onMoveToRow: (id: number, row: RowSlot) => void;
  onDelete: (id: number, url: string) => void;
}

const MODE_LABELS: Record<ModeFilter, string> = {
  both: "ทุกโหมด",
  "3row": "3 แถว",
  single: "หน้าเดี่ยว",
};

export function MediaCard({
  item,
  orderIndex,
  isTvKiosk,
  visibleRows,
  isDragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onUpdateDuration,
  onToggleActive,
  onUpdateModeFilter,
  onMoveToRow,
  onDelete,
}: MediaCardProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  return (
    <article
      className={`${styles.mediaCard} ${isDragging ? styles.isDragging : ""} ${!item.is_active ? styles.inactiveCard : ""}`}
      data-row={item.row_slot}
    >
      <div
        className={styles.orderRail}
        aria-label={`ลำดับ ${orderIndex + 1}`}
        draggable
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragEnd={onDragEnd}
        title="ลากเพื่อจัดลำดับ"
      >
        <span aria-hidden="true">⠿</span>
        <strong>{formatOrderNumber(orderIndex)}</strong>
      </div>

      <div className={styles.thumbnailFrame}>
        {thumbnailFailed ? (
          <div className={styles.brokenMedia}>
            <span aria-hidden="true">!</span>
            ไฟล์ต้นฉบับไม่พร้อมใช้งาน
          </div>
        ) : item.type === "image" ? (
          // Supabase library URLs are user-managed and rendered as lightweight previews.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt="ตัวอย่างสื่อ"
            loading="lazy"
            onError={() => setThumbnailFailed(true)}
          />
        ) : (
          <video
            src={item.url}
            muted
            preload="metadata"
            onError={() => setThumbnailFailed(true)}
          />
        )}
        <span className={styles.typeBadge}>
          {item.type === "image" ? "IMAGE" : "VIDEO"}
        </span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span className={styles.rowTag}>Row {item.row_slot}</span>
          <span
            className={
              item.is_active ? styles.activeStatus : styles.inactiveStatus
            }
          >
            {item.is_active ? "แสดงอยู่" : "ซ่อนอยู่"}
          </span>
        </div>

        <div className={styles.cardSettings}>
          {item.type === "image" && (
            <div className={styles.inlineStepper}>
              <span>ระยะเวลา</span>
              <button
                type="button"
                aria-label="ลดเวลา"
                onClick={() =>
                  onUpdateDuration(item.id, Math.max(3, item.duration - 1))
                }
              >
                −
              </button>
              <output>{item.duration} วินาที</output>
              <button
                type="button"
                aria-label="เพิ่มเวลา"
                onClick={() =>
                  onUpdateDuration(item.id, Math.min(60, item.duration + 1))
                }
              >
                +
              </button>
            </div>
          )}

          {!isTvKiosk && (
            <button
              type="button"
              className={styles.modeFilterButton}
              onClick={() =>
                onUpdateModeFilter(item.id, item.display_mode_filter)
              }
            >
              <span>ใช้กับ</span>
              {MODE_LABELS[item.display_mode_filter]}
            </button>
          )}
        </div>

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.statusAction}
            onClick={() => onToggleActive(item.id, item.is_active)}
          >
            {item.is_active ? "ซ่อนจากจอ" : "แสดงบนจอ"}
          </button>

          {visibleRows.length > 1 && (
            <label className={styles.moveControl}>
              <span>ย้ายไป</span>
              <select
                value={item.row_slot}
                onChange={(event) =>
                  onMoveToRow(item.id, Number(event.target.value) as RowSlot)
                }
              >
                {visibleRows.map((row) => (
                  <option key={row} value={row}>
                    Row {row}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => onDelete(item.id, item.url)}
          >
            ลบ
          </button>
        </div>
      </div>
    </article>
  );
}
