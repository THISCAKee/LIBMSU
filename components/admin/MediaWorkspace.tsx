"use client";

import type { DragEvent } from "react";
import { filterMediaForWorkspace } from "../../lib/adminView";
import { MediaCard } from "./MediaCard";
import type {
  AdminMediaItem,
  MediaRowFilter,
  ModeFilter,
  RowSlot,
} from "./types";
import styles from "./AdminStudio.module.css";

interface MediaWorkspaceProps {
  items: AdminMediaItem[];
  selectedKiosk: string;
  visibleRows: RowSlot[];
  filter: MediaRowFilter;
  isTvKiosk: boolean;
  isSavingOrder: boolean;
  draggingId: number | null;
  dragOverId: number | null;
  dragSourceRow: RowSlot | null;
  dropTargetRow: RowSlot | null;
  onFilterChange: (filter: MediaRowFilter) => void;
  onDragStart: (
    event: DragEvent<HTMLDivElement>,
    id: number,
    row: RowSlot,
  ) => void;
  onDragEnterCard: (id: number) => void;
  onRowDragEnter: (event: DragEvent<HTMLDivElement>, row: RowSlot) => void;
  onRowDragLeave: (event: DragEvent<HTMLDivElement>, row: RowSlot) => void;
  onRowDrop: (event: DragEvent<HTMLDivElement>, row: RowSlot) => void;
  onDragEnd: (row: RowSlot) => void;
  onUpdateDuration: (id: number, duration: number) => void;
  onToggleActive: (id: number, current: boolean) => void;
  onUpdateModeFilter: (id: number, current: ModeFilter) => void;
  onMoveToRow: (id: number, row: RowSlot) => void;
  onDelete: (id: number, url: string) => void;
}

export function MediaWorkspace({
  items,
  selectedKiosk,
  visibleRows,
  filter,
  isTvKiosk,
  isSavingOrder,
  draggingId,
  dragOverId,
  dragSourceRow,
  dropTargetRow,
  onFilterChange,
  onDragStart,
  onDragEnterCard,
  onRowDragEnter,
  onRowDragLeave,
  onRowDrop,
  onDragEnd,
  onUpdateDuration,
  onToggleActive,
  onUpdateModeFilter,
  onMoveToRow,
  onDelete,
}: MediaWorkspaceProps) {
  const kioskItems = filterMediaForWorkspace(items, selectedKiosk, "all");
  const filteredItems = filterMediaForWorkspace(
    items,
    selectedKiosk,
    filter,
  );
  const rowsToRender = filter === "all" ? visibleRows : [filter];

  return (
    <section className={styles.mediaWorkspace} aria-labelledby="media-title">
      <div className={styles.workspaceHeader}>
        <div>
          <p className={styles.eyebrow}>DISPLAY CONTENT</p>
          <h2 id="media-title">สื่อในจอนี้</h2>
          <p>จัดลำดับและตั้งค่าการแสดงผลจากรายการด้านล่าง</p>
        </div>
        <strong className={styles.totalCount}>{kioskItems.length} รายการ</strong>
      </div>

      {!isTvKiosk && (
        <div className={styles.filterBar} aria-label="กรองตาม Row">
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => onFilterChange("all")}
          >
            ทั้งหมด
            <strong>{kioskItems.length}</strong>
          </button>
          {visibleRows.map((row) => (
            <button
              key={row}
              type="button"
              aria-pressed={filter === row}
              onClick={() => onFilterChange(row)}
            >
              Row {row}
              <strong>
                {kioskItems.filter((item) => item.row_slot === row).length}
              </strong>
            </button>
          ))}
        </div>
      )}

      {isSavingOrder && (
        <div className={styles.savingStatus} role="status">
          <span /> กำลังบันทึกลำดับ
        </div>
      )}

      {rowsToRender.map((row) => {
        const rowItems = filteredItems
          .filter((item) => item.row_slot === row)
          .sort((a, b) => a.sort_order - b.sort_order);
        let displayItems = rowItems;

        if (
          draggingId !== null &&
          dragOverId !== null &&
          draggingId !== dragOverId &&
          dragSourceRow === row
        ) {
          const fromIndex = rowItems.findIndex((item) => item.id === draggingId);
          const toIndex = rowItems.findIndex((item) => item.id === dragOverId);
          if (fromIndex !== -1 && toIndex !== -1) {
            displayItems = [...rowItems];
            const [moved] = displayItems.splice(fromIndex, 1);
            displayItems.splice(toIndex, 0, moved);
          }
        }

        const isDropTarget = dropTargetRow === row;
        const acceptsCrossRow =
          draggingId !== null && dragSourceRow !== null && dragSourceRow !== row;

        return (
          <section
            key={row}
            className={`${styles.rowSection} ${isDropTarget ? styles.dropTarget : ""}`}
            data-row={row}
            onDragEnter={(event) => onRowDragEnter(event, row)}
            onDragLeave={(event) => onRowDragLeave(event, row)}
            onDragOver={(event) => {
              if (acceptsCrossRow) event.preventDefault();
            }}
            onDrop={(event) => onRowDrop(event, row)}
          >
            <div className={styles.rowHeader}>
              <div>
                <span className={styles.rowIndex}>0{row}</span>
                <h3>Row {row}</h3>
              </div>
              <div>
                <span>{isDropTarget ? "วางเพื่อย้ายมาที่นี่" : "ลากที่เลขลำดับเพื่อจัดคิว"}</span>
                <strong>{rowItems.length} รายการ</strong>
              </div>
            </div>

            {rowItems.length === 0 ? (
              <div className={styles.emptyRow}>
                <strong>Row นี้ยังไม่มีสื่อ</strong>
                <span>เพิ่มไฟล์จากแผงด้านซ้ายเพื่อเริ่มจัดลำดับ</span>
              </div>
            ) : (
              <div className={styles.mediaGrid}>
                {displayItems.map((item, index) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    orderIndex={index}
                    isTvKiosk={isTvKiosk}
                    visibleRows={visibleRows}
                    isDragging={draggingId === item.id}
                    onDragStart={(event) => onDragStart(event, item.id, row)}
                    onDragEnter={() => onDragEnterCard(item.id)}
                    onDragEnd={() => onDragEnd(row)}
                    onUpdateDuration={onUpdateDuration}
                    onToggleActive={onToggleActive}
                    onUpdateModeFilter={onUpdateModeFilter}
                    onMoveToRow={onMoveToRow}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
