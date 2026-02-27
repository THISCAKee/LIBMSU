"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface MediaItem {
  id: number;
  url: string;
  type: "image" | "video";
  duration: number;
  row_slot: 1 | 2 | 3;
  is_active: boolean;
  kiosk_id: string;
}

const KIOSK_LIST = ["kiosk-1", "kiosk-2", "kiosk-3", "kiosk-4"];

const ROW_LABELS: Record<1 | 2 | 3, string> = {
  1: "Row 1 (บน)",
  2: "Row 2 (กลาง)",
  3: "Row 3 (ล่าง)",
};

const ROW_COLORS: Record<1 | 2 | 3, string> = {
  1: "rgba(99,102,241,0.15)",
  2: "rgba(168,85,247,0.12)",
  3: "rgba(20,184,166,0.12)",
};

const ROW_ACCENT: Record<1 | 2 | 3, string> = {
  1: "#6366f1",
  2: "#a855f7",
  3: "#14b8a6",
};

export default function AdminPage() {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedRow, setSelectedRow] = useState<1 | 2 | 3>(1);
  const [selectedKiosk, setSelectedKiosk] = useState<string>("kiosk-1");
  const [duration, setDuration] = useState(10);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);
  const router = useRouter();
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        fetchMedia();
      }
    };
    checkUser();
  }, [router]);

  const fetchMedia = async () => {
    const { data } = await supabase
      .from("media_items")
      .select("*")
      .order("row_slot", { ascending: true })
      .order("created_at", { ascending: true });

    if (data) {
      // Normalize data (in case kiosk_id doesn't exist yet)
      const normalized = data.map((item) => ({
        ...item,
        kiosk_id: item.kiosk_id || "kiosk-1",
      })) as MediaItem[];
      setMediaList(normalized);
    }
    setLoading(false);
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

      const { error: uploadError } = await supabase.storage
        .from("kiosk-media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setUploadProgress(60);

      const {
        data: { publicUrl },
      } = supabase.storage.from("kiosk-media").getPublicUrl(fileName);

      const type = file.type.startsWith("video") ? "video" : "image";

      // ลอง insert พร้อม row_slot และ kiosk_id ก่อน
      let dbError: any = null;

      const { error: e1 } = await supabase.from("media_items").insert([
        {
          url: publicUrl,
          type,
          duration,
          row_slot: selectedRow,
          kiosk_id: selectedKiosk,
        },
      ]);
      dbError = e1;

      // Fallback: ถ้า column ขาดหายไปใน schema
      if (dbError) {
        console.error("DB Insert Error:", dbError);
        // ลอง insert แบบไม่มี kiosk_id
        if (dbError.message?.includes("kiosk_id")) {
          const { error: eKiosk } = await supabase
            .from("media_items")
            .insert([
              { url: publicUrl, type, duration, row_slot: selectedRow },
            ]);
          dbError = eKiosk;
          if (!eKiosk) {
            alert(
              "⚠️ อัปโหลดสำเร็จ แต่ยังไม่สามารถกำหนด Kiosk ได้\n\nกรุณารัน SQL ใน Supabase:\nALTER TABLE media_items ADD COLUMN IF NOT EXISTS kiosk_id text NOT NULL DEFAULT 'kiosk-1';",
            );
          }
        }

        // ถ้ายัง error row_slot แบบเก่า
        if (dbError?.message?.includes("row_slot")) {
          const { error: e2 } = await supabase
            .from("media_items")
            .insert([{ url: publicUrl, type, duration }]);
          dbError = e2;
          if (!e2) {
            alert(
              "⚠️ อัปโหลดสำเร็จ แต่ไม่สามารถกำหนด Row และ Kiosk ได้\n\nกรุณาเพิ่ม column row_slot และ kiosk_id ใน Supabase",
            );
          }
        }
      }

      if (dbError) throw dbError;

      setUploadProgress(100);
      setTimeout(() => {
        setFile(null);
        setUploadProgress(0);
        fetchMedia();
      }, 500);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAddFromLibrary = async (
    itemUrl: string,
    itemType: "image" | "video",
  ) => {
    let dbError: any = null;
    const { error: e1 } = await supabase.from("media_items").insert([
      {
        url: itemUrl,
        type: itemType,
        duration,
        row_slot: selectedRow,
        kiosk_id: selectedKiosk,
      },
    ]);
    dbError = e1;

    if (dbError) {
      if (dbError.message?.includes("kiosk_id")) {
        alert(
          "⚠️ สื่อถูกเพิ่มไปยัง Kiosk-1 เท่านั้น เนื่องจากฐานข้อมูลยังไม่มี Column 'kiosk_id'\n\nกรุณาไปที่ Supabase SQL Editor แล้วรันคำสั่ง:\nALTER TABLE media_items ADD COLUMN kiosk_id text NOT NULL DEFAULT 'kiosk-1';",
        );
        await supabase
          .from("media_items")
          .insert([
            { url: itemUrl, type: itemType, duration, row_slot: selectedRow },
          ]);
      } else if (dbError.message?.includes("row_slot")) {
        await supabase
          .from("media_items")
          .insert([{ url: itemUrl, type: itemType, duration }]);
      }
    }
    fetchMedia();
    setShowLibrary(false);
  };

  const handleDelete = async (id: number, url: string) => {
    if (!confirm("ต้องการลบไฟล์นี้ใช่ไหม?")) return;
    try {
      // เช็คว่ามีรายการอื่นใช้ไฟล์นี้อยู่หรือไม่
      const { data: sharedItems, error } = await supabase
        .from("media_items")
        .select("id")
        .eq("url", url)
        .neq("id", id);

      if (error) throw error;

      const isShared = sharedItems && sharedItems.length > 0;

      // ลบเรคคอร์ดออกจากฐานข้อมูล
      await supabase.from("media_items").delete().eq("id", id);

      // ถ้าไม่มีที่ไหนใช้แล้ว ค่อยลบจาก Storage
      if (!isShared) {
        const fileName = url.split("/").pop();
        if (fileName) {
          await supabase.storage.from("kiosk-media").remove([fileName]);
        }
      }

      setMediaList(mediaList.filter((item) => item.id !== id));
    } catch (error: any) {
      alert("ลบไม่สำเร็จ: " + error.message);
    }
  };

  const handleUpdateDuration = async (id: number, newDuration: number) => {
    await supabase
      .from("media_items")
      .update({ duration: newDuration })
      .eq("id", id);
    setMediaList(
      mediaList.map((m) => (m.id === id ? { ...m, duration: newDuration } : m)),
    );
  };

  const handleMoveRow = async (id: number, newRow: 1 | 2 | 3) => {
    await supabase
      .from("media_items")
      .update({ row_slot: newRow })
      .eq("id", id);
    setMediaList(
      mediaList.map((m) => (m.id === id ? { ...m, row_slot: newRow } : m)),
    );
  };

  const handleMoveKiosk = async (id: number, newKiosk: string) => {
    const { error } = await supabase
      .from("media_items")
      .update({ kiosk_id: newKiosk })
      .eq("id", id);

    if (error && error.message?.includes("kiosk_id")) {
      alert(
        "⚠️ ย้าย Kiosk ไม่สำเร็จ เนื่องจากฐานข้อมูลยังไม่มี Column 'kiosk_id'\n\nกรุณาไปที่ Supabase SQL Editor แล้วรันคำสั่ง:\nALTER TABLE media_items ADD COLUMN kiosk_id text NOT NULL DEFAULT 'kiosk-1';",
      );
      return;
    }

    setMediaList(
      mediaList.map((m) => (m.id === id ? { ...m, kiosk_id: newKiosk } : m)),
    );
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    const newVal = !current;
    // Optimistic update
    setMediaList(
      mediaList.map((m) => (m.id === id ? { ...m, is_active: newVal } : m)),
    );
    const { error } = await supabase
      .from("media_items")
      .update({ is_active: newVal })
      .eq("id", id);
    if (error) {
      // Revert on error
      setMediaList(
        mediaList.map((m) => (m.id === id ? { ...m, is_active: current } : m)),
      );
      alert("อัปเดตไม่สำเร็จ: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="kiosk-spinner" />
        <span style={{ fontSize: "0.875rem" }}>กำลังตรวจสอบสิทธิ์...</span>
      </div>
    );
  }

  const rows: (1 | 2 | 3)[] = [1, 2, 3];

  return (
    <div className="dash-page">
      {/* ===== Header ===== */}
      <header className="dash-header">
        <div className="dash-logo">
          <div className="dash-logo-icon">🖥️</div>
          <span className="dash-logo-text">Kiosk Admin</span>
          <span className="dash-badge">3-Row Layout</span>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a href="/" target="_blank" className="dash-preview-btn">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            ดูหน้า Kiosk
          </a>
          <button onClick={handleLogout} className="dash-logout-btn">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="dash-content">
        {/* ===== Kiosk Selector ===== */}
        <div className="dash-kiosk-selector" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "1rem" }}>
            จัดการจอแสดงผล (Kiosk)
          </h3>
          <div
            className="dash-row-tabs"
            style={{
              display: "inline-flex",
              background: "var(--bg-card)",
              padding: "0.25rem",
              borderRadius: "10px",
              border: "1px solid var(--border-light)",
            }}
          >
            {KIOSK_LIST.map((k) => (
              <button
                key={k}
                className={`dash-row-tab ${selectedKiosk === k ? "active" : ""}`}
                style={
                  selectedKiosk === k
                    ? ({
                        "--tab-color": "#3b82f6",
                      } as React.CSSProperties)
                    : {}
                }
                onClick={() => setSelectedKiosk(k)}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ===== Upload Section ===== */}
        <div className="dash-upload-card">
          <div
            className="dash-upload-card-title"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              เพิ่มสื่อใหม่
            </div>
            <button
              onClick={() => setShowLibrary(true)}
              style={{
                background: "rgba(59, 130, 246, 0.1)",
                color: "#3b82f6",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                padding: "0.4rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M2 15h10" />
                <path d="M9 18l3-3-3-3" />
              </svg>
              เลือกจากคลังสื่อ
            </button>
          </div>

          {/* Drag & Drop Zone */}
          <div
            ref={dropZoneRef}
            className={`dash-dropzone ${dragOver ? "dragover" : ""} ${file ? "has-file" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById("admin-file-input")?.click()}
          >
            <input
              id="admin-file-input"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            {file ? (
              <div className="dash-dropzone-file">
                <span className="dash-dropzone-icon">
                  {file.type.startsWith("video") ? "🎬" : "🖼️"}
                </span>
                <div>
                  <div className="dash-dropzone-filename">{file.name}</div>
                  <div className="dash-dropzone-filesize">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  className="dash-dropzone-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="dash-dropzone-placeholder">
                <div className="dash-dropzone-icon-big">📤</div>
                <div className="dash-dropzone-text">
                  ลาก & วางไฟล์ หรือ คลิกเพื่อเลือก
                </div>
                <div className="dash-dropzone-hint">
                  รองรับ JPG, PNG, GIF, MP4, MOV
                </div>
              </div>
            )}
          </div>

          {/* Upload Options */}
          <div className="dash-upload-options">
            {/* Row Selector */}
            <div className="dash-option-group">
              <label className="dash-option-label">แสดงใน Row</label>
              <div className="dash-row-tabs">
                {rows.map((r) => (
                  <button
                    key={r}
                    className={`dash-row-tab ${selectedRow === r ? "active" : ""}`}
                    style={
                      selectedRow === r
                        ? ({
                            "--tab-color": ROW_ACCENT[r],
                          } as React.CSSProperties)
                        : {}
                    }
                    onClick={() => setSelectedRow(r)}
                  >
                    {ROW_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration & Upload */}
            <div className="dash-option-right">
              <div className="dash-option-group">
                <label className="dash-option-label">ระยะเวลา (วินาที)</label>
                <div className="dash-duration-input">
                  <button
                    onClick={() => setDuration(Math.max(3, duration - 1))}
                  >
                    −
                  </button>
                  <span>{duration}s</span>
                  <button
                    onClick={() => setDuration(Math.min(60, duration + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="dash-upload-btn-main"
              >
                {uploading ? (
                  <>
                    <span
                      className="kiosk-spinner"
                      style={{
                        width: "0.875rem",
                        height: "0.875rem",
                        borderWidth: "2px",
                      }}
                    />
                    {uploadProgress > 0
                      ? `${uploadProgress}%`
                      : "กำลังอัปโหลด..."}
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    อัปโหลด
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="dash-upload-progress">
              <div
                className="dash-upload-progress-bar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* ===== Row Sections ===== */}
        {rows.map((rowNum) => {
          const rowItems = mediaList.filter(
            (m) => m.row_slot === rowNum && m.kiosk_id === selectedKiosk,
          );
          return (
            <div
              key={rowNum}
              className="dash-row-section"
              style={
                {
                  "--row-bg": ROW_COLORS[rowNum],
                  "--row-accent": ROW_ACCENT[rowNum],
                } as React.CSSProperties
              }
            >
              <div className="dash-row-header">
                <div
                  className="dash-row-label-dot"
                  style={{ background: ROW_ACCENT[rowNum] }}
                />
                <div className="dash-row-section-title">
                  {ROW_LABELS[rowNum]}
                </div>
                <div className="dash-grid-count">{rowItems.length} รายการ</div>
              </div>

              {rowItems.length === 0 ? (
                <div className="dash-empty">
                  <div className="dash-empty-icon">📭</div>
                  <div className="dash-empty-text">ยังไม่มีสื่อใน Row นี้</div>
                </div>
              ) : (
                <div className="dash-grid">
                  {rowItems.map((item) => (
                    <div
                      key={item.id}
                      className={`dash-media-card ${!item.is_active ? "inactive" : ""}`}
                    >
                      {/* Thumbnail */}
                      {item.type === "image" ? (
                        <img
                          src={item.url}
                          alt="Broken Image"
                          className="dash-media-thumb"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.parentElement?.classList.add(
                              "has-error",
                            );
                          }}
                        />
                      ) : (
                        <video
                          src={item.url}
                          className="dash-media-thumb"
                          preload="metadata"
                          muted
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.parentElement?.classList.add(
                              "has-error",
                            );
                          }}
                        />
                      )}

                      {/* Fallback Error Overlay (Shown by CSS if .has-error) */}
                      <div
                        className="dash-media-error"
                        style={{
                          display: "none",
                          position: "absolute",
                          inset: 0,
                          background: "#333",
                          color: "#ff6b6b",
                          flexFlow: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          padding: "1rem",
                          fontSize: "0.8rem",
                          zIndex: 1,
                          pointerEvents: "none",
                        }}
                      >
                        <span
                          style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}
                        >
                          ⚠️
                        </span>
                        ไฟล์ต้นฉบับถูกลบไปแล้ว
                      </div>

                      {/* Inactive overlay dim */}
                      {!item.is_active && <div className="dash-inactive-dim" />}

                      {/* Type Badge — มุมซ้ายบน */}
                      <div
                        className="dash-media-type"
                        style={{ left: "2.75rem" }}
                      ></div>

                      {/* 🗑️ Trash icon — มุมซ้ายบน */}
                      <button
                        onClick={() => handleDelete(item.id, item.url)}
                        className="dash-trash-btn"
                        title="ลบ"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>

                      {/* ===== ปุ่มแสดง/ซ่อน — ลอยทับภาพ ไม่บีบ thumbnail ===== */}
                      <button
                        onClick={() =>
                          handleToggleActive(item.id, item.is_active)
                        }
                        className={`dash-float-toggle ${item.is_active ? "on" : "off"}`}
                      >
                        {item.is_active ? (
                          <>
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            แสดงอยู่
                          </>
                        ) : (
                          <>
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                            ซ่อนอยู่
                          </>
                        )}
                      </button>

                      {/* Controls Overlay */}
                      <div className="dash-media-overlay">
                        <div className="dash-media-controls">
                          {/* Toggle Active */}
                          <button
                            onClick={() =>
                              handleToggleActive(item.id, item.is_active)
                            }
                            className={`dash-toggle-btn ${item.is_active ? "on" : "off"}`}
                            title={
                              item.is_active ? "ซ่อนจากหน้าจอ" : "แสดงบนหน้าจอ"
                            }
                          >
                            {item.is_active ? (
                              <>
                                <svg
                                  width="13"
                                  height="13"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                แสดงอยู่
                              </>
                            ) : (
                              <>
                                <svg
                                  width="13"
                                  height="13"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M17.94 17.94A10.07 10verlay0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                  <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                                ซ่อนอยู่
                              </>
                            )}
                          </button>

                          {/* Duration (images only) */}
                          {item.type === "image" && (
                            <div className="dash-media-duration">
                              <button
                                onClick={() =>
                                  handleUpdateDuration(
                                    item.id,
                                    Math.max(3, item.duration - 1),
                                  )
                                }
                              >
                                −
                              </button>
                              <span>{item.duration}s</span>
                              <button
                                onClick={() =>
                                  handleUpdateDuration(
                                    item.id,
                                    Math.min(60, item.duration + 1),
                                  )
                                }
                              >
                                +
                              </button>
                            </div>
                          )}

                          {/* Move to Row */}
                          <div className="dash-media-move">
                            <span
                              style={{
                                fontSize: "0.625rem",
                                color: "rgba(255,255,255,0.5)",
                                marginBottom: "0.25rem",
                              }}
                            >
                              ย้ายไป (แถว)
                            </span>
                            <div style={{ display: "flex", gap: "0.25rem" }}>
                              {rows
                                .filter((r) => r !== rowNum)
                                .map((r) => (
                                  <button
                                    key={r}
                                    className="dash-move-btn"
                                    style={
                                      {
                                        "--move-color": ROW_ACCENT[r],
                                      } as React.CSSProperties
                                    }
                                    onClick={() => handleMoveRow(item.id, r)}
                                    title={`ย้ายไป ${ROW_LABELS[r]}`}
                                  >
                                    R{r}
                                  </button>
                                ))}
                            </div>
                          </div>

                          {/* Move to Kiosk */}
                          <div
                            className="dash-media-move"
                            style={{ marginTop: "0.25rem" }}
                          >
                            <span
                              style={{
                                fontSize: "0.625rem",
                                color: "rgba(255,255,255,0.5)",
                                marginBottom: "0.25rem",
                              }}
                            >
                              ย้ายไป (Kiosk)
                            </span>
                            <div
                              style={{
                                display: "flex",
                                gap: "0.25rem",
                                flexWrap: "wrap",
                              }}
                            >
                              {KIOSK_LIST.filter(
                                (k) => k !== item.kiosk_id,
                              ).map((k) => (
                                <button
                                  key={k}
                                  className="dash-move-btn"
                                  style={
                                    {
                                      "--move-color": "#3b82f6",
                                      padding: "0.15rem 0.35rem",
                                    } as React.CSSProperties
                                  }
                                  onClick={() => handleMoveKiosk(item.id, k)}
                                  title={`ย้ายไป ${k}`}
                                >
                                  {k.replace("kiosk-", "K")}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Delete button ย้ายไปมุมขวาบนของการ์ดแล้ว */}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== Library Modal ===== */}
      {showLibrary && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.6)",
            zIndex: 100,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              width: "90%",
              maxWidth: "800px",
              height: "80vh",
              borderRadius: "12px",
              border: "1px solid var(--border-light)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                padding: "1.25rem",
                borderBottom: "1px solid var(--border-light)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                คลังสื่อ (เลือกเพื่อให้แสดงใน {selectedKiosk.toUpperCase()} -{" "}
                {ROW_LABELS[selectedRow]})
              </h3>
              <button
                onClick={() => setShowLibrary(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#888",
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                padding: "1.5rem",
                overflowY: "auto",
                flex: 1,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1.25rem",
                alignContent: "start",
              }}
            >
              {Array.from(
                new Map(mediaList.map((item) => [item.url, item])).values(),
              ).map((item: any) => (
                <div
                  key={item.url}
                  onClick={() => handleAddFromLibrary(item.url, item.type)}
                  style={{
                    position: "relative",
                    aspectRatio: "16/9",
                    background: "#000",
                    borderRadius: "8px",
                    overflow: "hidden",
                    cursor: "pointer",
                    border: "2px solid transparent",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.transform = "scale(1.02)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {item.type === "image" ? (
                    <img
                      src={item.url}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <video
                      src={item.url}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      muted
                    />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      width: "100%",
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
                      color: "white",
                      fontSize: "0.80rem",
                      padding: "0.75rem 0.5rem 0.5rem 0.5rem",
                      textAlign: "center",
                      pointerEvents: "none",
                    }}
                  >
                    + เพิ่มลงช่องนี้
                  </div>
                </div>
              ))}
              {mediaList.length === 0 && (
                <div
                  style={{
                    gridColumn: "1/-1",
                    textAlign: "center",
                    color: "#888",
                    padding: "3rem",
                  }}
                >
                  ยังไม่มีสื่อในระบบ
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
