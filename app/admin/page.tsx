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
}

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
  const [duration, setDuration] = useState(10);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

    if (data) setMediaList(data as MediaItem[]);
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

      // ลอง insert พร้อม row_slot ก่อน — ถ้า column ยังไม่มีใน DB ให้ fallback
      let dbError: any = null;

      const { error: e1 } = await supabase
        .from("media_items")
        .insert([{ url: publicUrl, type, duration, row_slot: selectedRow }]);
      dbError = e1;

      // Fallback: ถ้า column row_slot ยังไม่มีใน schema
      if (dbError?.message?.includes("row_slot")) {
        const { error: e2 } = await supabase
          .from("media_items")
          .insert([{ url: publicUrl, type, duration }]);
        dbError = e2;
        if (!e2) {
          alert(
            "⚠️ อัปโหลดสำเร็จ แต่ยังไม่สามารถกำหนด Row ได้\n\nกรุณารัน SQL ใน Supabase:\nALTER TABLE media_items ADD COLUMN IF NOT EXISTS row_slot smallint NOT NULL DEFAULT 1 CHECK (row_slot IN (1, 2, 3));",
          );
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

  const handleDelete = async (id: number, url: string) => {
    if (!confirm("ต้องการลบไฟล์นี้ใช่ไหม?")) return;
    try {
      const fileName = url.split("/").pop();
      if (fileName)
        await supabase.storage.from("kiosk-media").remove([fileName]);
      await supabase.from("media_items").delete().eq("id", id);
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
        {/* ===== Upload Section ===== */}
        <div className="dash-upload-card">
          <div className="dash-upload-card-title">
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
          const rowItems = mediaList.filter((m) => m.row_slot === rowNum);
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
                          alt=""
                          className="dash-media-thumb"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={item.url}
                          className="dash-media-thumb"
                          preload="metadata"
                          muted
                        />
                      )}

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
                              ย้ายไป
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
    </div>
  );
}
