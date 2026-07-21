"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  deleteMedia,
  insertMediaWithCompatibility,
  requireSupabaseSuccess,
  runOptimisticMutation,
  uploadMedia,
} from "@/lib/mediaOperations";
import {
  countMediaByKiosk,
  moveMediaToRow,
  visibleRowsForKiosk,
} from "@/lib/adminView";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ScreenSwitcher } from "@/components/admin/ScreenSwitcher";
import { UploadPanel } from "@/components/admin/UploadPanel";
import { MediaWorkspace } from "@/components/admin/MediaWorkspace";
import { MediaLibraryModal } from "@/components/admin/MediaLibraryModal";
import type {
  AdminMediaItem,
  DisplayMode,
  MediaRowFilter,
  ModeFilter,
  RowSlot,
} from "@/components/admin/types";
import styles from "@/components/admin/AdminStudio.module.css";

const KIOSK_LIST = [
  "kiosk-1",
  "kiosk-2",
  "kiosk-3",
  "kiosk-SPACE",
  "kiosk-TV",
] as const;

export default function AdminPage() {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedRow, setSelectedRow] = useState<RowSlot>(1);
  const [selectedKiosk, setSelectedKiosk] = useState<string>("kiosk-1");
  const [duration, setDuration] = useState(10);
  const [mediaList, setMediaList] = useState<AdminMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("3row");
  const [mediaRowFilter, setMediaRowFilter] =
    useState<MediaRowFilter>("all");
  const [isSavingMode, setIsSavingMode] = useState(false);
  // Drag-and-drop reorder state
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragSourceRow, setDragSourceRow] = useState<RowSlot | null>(null);
  const [dropTargetRow, setDropTargetRow] = useState<RowSlot | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const router = useRouter();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const libraryTriggerRef = useRef<HTMLButtonElement>(null);
  const dragNodeRef = useRef<number | null>(null);
  const dragSourceRowRef = useRef<RowSlot | null>(null);
  // Refs for reading latest values inside drag callbacks (avoids stale closure)
  const dragOverIdRef = useRef<number | null>(null);
  const mediaListRef = useRef<AdminMediaItem[]>([]);

  useEffect(() => {
    mediaListRef.current = mediaList;
  }, [mediaList]);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        fetchMedia();
        fetchDisplayMode(selectedKiosk);
      }
    };
    checkUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchMedia = async () => {
    const { data } = await supabase
      .from("media_items")
      .select("*")
      .order("row_slot", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (data) {
      const normalized = data.map((item, idx) => ({
        ...item,
        kiosk_id: item.kiosk_id || "kiosk-1",
        sort_order: item.sort_order ?? idx,
        display_mode_filter: (item.display_mode_filter as ModeFilter) || "both",
      })) as AdminMediaItem[];
      setMediaList(normalized);
      mediaListRef.current = normalized;
    }
    setLoading(false);
  };

  const fetchDisplayMode = async (kioskId: string) => {
    try {
      const { data } = await supabase
        .from("kiosk_settings")
        .select("display_mode")
        .eq("kiosk_id", kioskId)
        .maybeSingle();
      if (data?.display_mode === "single" || data?.display_mode === "3row") {
        setDisplayMode(data.display_mode);
      } else {
        setDisplayMode("3row"); // default
      }
    } catch {
      setDisplayMode("3row");
    }
  };

  const handleSetDisplayMode = async (mode: DisplayMode) => {
    const previousMode = displayMode;
    setDisplayMode(mode);
    setIsSavingMode(true);
    try {
      const result = await supabase
        .from("kiosk_settings")
        .upsert(
          { kiosk_id: selectedKiosk, display_mode: mode },
          { onConflict: "kiosk_id" },
        );
      requireSupabaseSuccess(result, "บันทึกโหมดแสดงผล");
    } catch (error) {
      setDisplayMode(previousMode);
      alert(
        error instanceof Error ? error.message : "บันทึกโหมดแสดงผลไม่สำเร็จ",
      );
    } finally {
      setIsSavingMode(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;

      setUploadProgress(60);
      const result = await uploadMedia(
        {
          uploadObject: (objectName, selectedFile) =>
            supabase.storage
              .from("kiosk-media")
              .upload(objectName, selectedFile),
          getPublicUrl: (objectName) =>
            supabase.storage.from("kiosk-media").getPublicUrl(objectName).data
              .publicUrl,
          insertRecord: (value) =>
            supabase.from("media_items").insert([value]),
          removeObject: (objectName) =>
            supabase.storage.from("kiosk-media").remove([objectName]),
        },
        {
          file,
          objectName: fileName,
          duration,
          rowSlot: selectedRow,
          kioskId: selectedKiosk,
        },
      );

      if (result.fallback === "without-kiosk") {
        alert(
          "⚠️ อัปโหลดสำเร็จ แต่ยังไม่สามารถกำหนด Kiosk ได้\n\nกรุณารัน SQL ใน Supabase:\nALTER TABLE media_items ADD COLUMN IF NOT EXISTS kiosk_id text NOT NULL DEFAULT 'kiosk-1';",
        );
      } else if (result.fallback === "basic") {
        alert(
          "⚠️ อัปโหลดสำเร็จ แต่ไม่สามารถกำหนด Row และ Kiosk ได้\n\nกรุณาเพิ่ม column row_slot และ kiosk_id ใน Supabase",
        );
      }

      setUploadProgress(100);
      setTimeout(() => {
        setFile(null);
        setUploadProgress(0);
        fetchMedia();
      }, 500);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "อัปโหลดสื่อไม่สำเร็จ",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleAddFromLibrary = async (
    itemUrl: string,
    itemType: "image" | "video",
  ) => {
    try {
      const result = await insertMediaWithCompatibility(
        (value) => supabase.from("media_items").insert([value]),
        {
          url: itemUrl,
          type: itemType,
          duration,
          row_slot: selectedRow,
          kiosk_id: selectedKiosk,
        },
      );

      if (result.fallback === "without-kiosk") {
        alert(
          "⚠️ สื่อถูกเพิ่มไปยัง Kiosk-1 เท่านั้น เนื่องจากฐานข้อมูลยังไม่มี Column 'kiosk_id'\n\nกรุณาไปที่ Supabase SQL Editor แล้วรันคำสั่ง:\nALTER TABLE media_items ADD COLUMN kiosk_id text NOT NULL DEFAULT 'kiosk-1';",
        );
      } else if (result.fallback === "basic") {
        alert(
          "⚠️ เพิ่มสื่อสำเร็จ แต่ไม่สามารถกำหนด Row และ Kiosk ได้\n\nกรุณาเพิ่ม column row_slot และ kiosk_id ใน Supabase",
        );
      }

      await fetchMedia();
      setShowLibrary(false);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "เพิ่มสื่อจากคลังไม่สำเร็จ",
      );
    }
  };

  const handleDelete = async (id: number, url: string) => {
    if (!confirm("ต้องการลบไฟล์นี้ใช่ไหม?")) return;

    try {
      const result = await deleteMedia(
        {
          findShared: (sharedUrl, currentId) =>
            supabase
              .from("media_items")
              .select("id")
              .eq("url", sharedUrl)
              .neq("id", currentId),
          deleteRecord: (currentId) =>
            supabase.from("media_items").delete().eq("id", currentId),
          removeObject: (objectName) =>
            supabase.storage.from("kiosk-media").remove([objectName]),
        },
        { id, url },
      );

      setMediaList((prev) => prev.filter((item) => item.id !== id));
      if (result.cleanupWarning) {
        alert(
          `ลบรายการแล้ว แต่ลบไฟล์ ${result.cleanupWarning.objectName} จากคลังไม่สำเร็จ: ${result.cleanupWarning.message}`,
        );
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "ลบรายการไม่สำเร็จ");
    }
  };

  const handleUpdateDuration = async (id: number, newDuration: number) => {
    try {
      const result = await supabase
        .from("media_items")
        .update({ duration: newDuration })
        .eq("id", id);
      requireSupabaseSuccess(result, "อัปเดตระยะเวลา");
      setMediaList((prev) =>
        prev.map((m) => (m.id === id ? { ...m, duration: newDuration } : m)),
      );
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "อัปเดตระยะเวลาไม่สำเร็จ",
      );
    }
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    const newVal = !current;
    setMediaList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_active: newVal } : m)),
    );

    try {
      await runOptimisticMutation(
        () =>
          supabase
            .from("media_items")
            .update({ is_active: newVal })
            .eq("id", id),
        () =>
          setMediaList((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, is_active: current } : m,
            ),
          ),
        "อัปเดตสถานะสื่อ",
      );
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "อัปเดตสถานะสื่อไม่สำเร็จ",
      );
    }
  };

  const handleUpdateModeFilter = async (id: number, current: ModeFilter) => {
    const cycle: Record<ModeFilter, ModeFilter> = {
      both: "3row",
      "3row": "single",
      single: "both",
    };
    const next = cycle[current];
    setMediaList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, display_mode_filter: next } : m)),
    );
    try {
      await runOptimisticMutation(
        () =>
          supabase
            .from("media_items")
            .update({ display_mode_filter: next })
            .eq("id", id),
        () =>
          setMediaList((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, display_mode_filter: current } : m,
            ),
          ),
        "อัปเดตโหมดของสื่อ",
      );
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "อัปเดตโหมดของสื่อไม่สำเร็จ",
      );
    }
  };

  // ===== Drag-and-drop handlers (same-row reorder + cross-row move) =====
  const handleDragStart = useCallback(
    (e: React.DragEvent, id: number, rowNum: 1 | 2 | 3) => {
      dragNodeRef.current = id;
      dragSourceRowRef.current = rowNum;
      setDraggingId(id);
      setDragSourceRow(rowNum);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragEnterCard = useCallback((id: number) => {
    if (dragNodeRef.current === id) return;
    dragOverIdRef.current = id; // update ref immediately (no batching delay)
    setDragOverId(id); // update state for visual feedback
  }, []);

  const handleRowDragEnter = useCallback(
    (e: React.DragEvent, rowNum: 1 | 2 | 3) => {
      e.preventDefault();
      if (
        dragSourceRowRef.current !== null &&
        dragSourceRowRef.current !== rowNum
      ) {
        setDropTargetRow(rowNum);
      }
    },
    [],
  );

  const handleRowDragLeave = useCallback(
    (e: React.DragEvent, rowNum: 1 | 2 | 3) => {
      // Only clear if leaving the section itself (not entering a child)
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDropTargetRow((prev) => (prev === rowNum ? null : prev));
      }
    },
    [],
  );

  const handleRowDrop = useCallback(
    async (e: React.DragEvent, targetRow: 1 | 2 | 3) => {
      e.preventDefault();
      const fromId = dragNodeRef.current;
      const sourceRow = dragSourceRowRef.current;

      // If dropped in the same row, do nothing here and do not clear refs!
      // Let handleDragEnd process the same-row reorder.
      if (fromId === null || sourceRow === null || sourceRow === targetRow)
        return;

      const originalItem = mediaListRef.current.find(
        (item) => item.id === fromId,
      );

      // It's a cross-row move, clear refs & states
      dragNodeRef.current = null;
      dragSourceRowRef.current = null;
      dragOverIdRef.current = null;
      setDraggingId(null);
      setDragOverId(null);
      setDragSourceRow(null);
      setDropTargetRow(null);

      // Optimistic: move item to new row
      setMediaList((prev) =>
        prev.map((m) =>
          m.id === fromId ? { ...m, row_slot: targetRow, sort_order: 9999 } : m,
        ),
      );

      // Persist row_slot change
      setIsSavingOrder(true);
      try {
        const result = await supabase
          .from("media_items")
          .update({ row_slot: targetRow })
          .eq("id", fromId);
        requireSupabaseSuccess(result, "ย้ายสื่อไปยังแถวใหม่");
      } catch (error) {
        if (originalItem) {
          setMediaList((prev) =>
            prev.map((m) => (m.id === fromId ? originalItem : m)),
          );
        }
        alert(
          error instanceof Error ? error.message : "ย้ายสื่อไม่สำเร็จ",
        );
      } finally {
        setIsSavingOrder(false);
      }
    },
    [],
  );

  const handleDragEnd = useCallback(
    async (rowNum: 1 | 2 | 3) => {
      // Read from refs — always current, never stale
      const fromId = dragNodeRef.current;
      const toId = dragOverIdRef.current; // ← ref, not state
      const sourceRow = dragSourceRowRef.current;
      const previousList = mediaListRef.current;

      // Clear all drag refs & state
      dragNodeRef.current = null;
      dragSourceRowRef.current = null;
      dragOverIdRef.current = null;
      setDraggingId(null);
      setDragOverId(null);
      setDragSourceRow(null);
      setDropTargetRow(null);

      // Only reorder within the same row
      if (fromId === null || toId === null || fromId === toId) return;
      if (sourceRow !== rowNum) return;

      // Re-order optimistically using ref (no stale closure)
      setMediaList((prev) => {
        mediaListRef.current = prev; // keep ref in sync
        const rowItems = prev
          .filter((m) => m.row_slot === rowNum && m.kiosk_id === selectedKiosk)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        const fromIdx = rowItems.findIndex((m) => m.id === fromId);
        const toIdx = rowItems.findIndex((m) => m.id === toId);
        if (fromIdx === -1 || toIdx === -1) return prev;

        const reordered = [...rowItems];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);

        const updated = reordered.map((item, idx) => ({
          ...item,
          sort_order: idx,
        }));

        const next = prev.map((m) => updated.find((u) => u.id === m.id) ?? m);
        mediaListRef.current = next;
        return next;
      });

      // Persist sort_order — read from ref so we always have fresh data
      setIsSavingOrder(true);
      try {
        // Give setMediaList one tick to commit, then read from ref
        await new Promise((r) => setTimeout(r, 0));
        const snapshot = mediaListRef.current
          .filter((m) => m.row_slot === rowNum && m.kiosk_id === selectedKiosk)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        const results = await Promise.all(
          snapshot.map((item) =>
            supabase
              .from("media_items")
              .update({ sort_order: item.sort_order })
              .eq("id", item.id),
          ),
        );
        results.forEach((result) =>
          requireSupabaseSuccess(result, "บันทึกลำดับสื่อ"),
        );
      } catch (error) {
        mediaListRef.current = previousList;
        setMediaList(previousList);
        alert(
          error instanceof Error ? error.message : "บันทึกลำดับสื่อไม่สำเร็จ",
        );
      } finally {
        setIsSavingOrder(false);
      }
    },
    [selectedKiosk], // ← no longer depends on dragOverId or mediaList
  );

  const handleMoveToRow = async (id: number, targetRow: RowSlot) => {
    const current = mediaListRef.current.find((item) => item.id === id);
    if (!current || current.row_slot === targetRow) return;

    const previous = mediaListRef.current;
    const moved = moveMediaToRow(previous, id, targetRow, selectedKiosk);
    setMediaList(moved.items);
    mediaListRef.current = moved.items;

    setIsSavingOrder(true);
    try {
      const result = await supabase
        .from("media_items")
        .update({ row_slot: targetRow, sort_order: moved.sortOrder })
        .eq("id", id);
      requireSupabaseSuccess(result, "ย้ายสื่อไป Row ใหม่");
    } catch (error) {
      setMediaList(previous);
      mediaListRef.current = previous;
      alert(error instanceof Error ? error.message : "ย้ายสื่อไม่สำเร็จ");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSelectKiosk = (kioskId: string) => {
    setSelectedKiosk(kioskId);
    setMediaRowFilter("all");
    if (kioskId === "kiosk-TV") {
      setSelectedRow(1);
    } else {
      fetchDisplayMode(kioskId);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <span className={styles.loadingMark} aria-hidden="true">
          MS
        </span>
        <div>
          <strong>กำลังเปิด Media Studio</strong>
          <span>ตรวจสอบสิทธิ์และเตรียมรายการสื่อ</span>
        </div>
      </div>
    );
  }

  const isTvKiosk = selectedKiosk === "kiosk-TV";
  const visibleRows = visibleRowsForKiosk(selectedKiosk);
  const mediaCounts = countMediaByKiosk(mediaList);
  const previewHref = isTvKiosk ? "/tv" : "/";

  return (
    <div className={styles.page}>
      <AdminHeader
        selectedKiosk={selectedKiosk}
        isTvKiosk={isTvKiosk}
        previewHref={previewHref}
        onLogout={handleLogout}
      />

      <ScreenSwitcher
        kiosks={KIOSK_LIST}
        selectedKiosk={selectedKiosk}
        mediaCounts={mediaCounts}
        displayMode={displayMode}
        isSavingMode={isSavingMode}
        onSelectKiosk={handleSelectKiosk}
        onSelectMode={handleSetDisplayMode}
      />

      <main className={styles.workspace}>
        <UploadPanel
          file={file}
          selectedRow={selectedRow}
          visibleRows={visibleRows}
          duration={duration}
          uploading={uploading}
          uploadProgress={uploadProgress}
          dragOver={dragOver}
          dropZoneRef={dropZoneRef}
          libraryTriggerRef={libraryTriggerRef}
          onFileChange={handleFileChange}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClearFile={() => setFile(null)}
          onSelectRow={setSelectedRow}
          onChangeDuration={setDuration}
          onUpload={handleUpload}
          onOpenLibrary={() => setShowLibrary(true)}
        />

        <MediaWorkspace
          items={mediaList}
          selectedKiosk={selectedKiosk}
          visibleRows={visibleRows}
          filter={mediaRowFilter}
          isTvKiosk={isTvKiosk}
          isSavingOrder={isSavingOrder}
          draggingId={draggingId}
          dragOverId={dragOverId}
          dragSourceRow={dragSourceRow}
          dropTargetRow={dropTargetRow}
          onFilterChange={setMediaRowFilter}
          onDragStart={handleDragStart}
          onDragEnterCard={handleDragEnterCard}
          onRowDragEnter={handleRowDragEnter}
          onRowDragLeave={handleRowDragLeave}
          onRowDrop={handleRowDrop}
          onDragEnd={handleDragEnd}
          onUpdateDuration={handleUpdateDuration}
          onToggleActive={handleToggleActive}
          onUpdateModeFilter={handleUpdateModeFilter}
          onMoveToRow={handleMoveToRow}
          onDelete={handleDelete}
        />
      </main>

      <MediaLibraryModal
        open={showLibrary}
        media={mediaList}
        selectedKiosk={selectedKiosk}
        selectedRow={selectedRow}
        triggerRef={libraryTriggerRef}
        onAdd={handleAddFromLibrary}
        onClose={() => setShowLibrary(false)}
      />
    </div>
  );
}
