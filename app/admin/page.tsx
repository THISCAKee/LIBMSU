"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface MediaItem {
  id: number;
  url: string;
  type: "image" | "video";
}

export default function AdminPage() {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // ตรวจสอบ Auth และโหลดข้อมูล
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
    const { data, error } = await supabase
      .from("media_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setMediaList(data as MediaItem[]);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleUpload = async () => {
    if (!file) return alert("กรุณาเลือกไฟล์");
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("kiosk-media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("kiosk-media").getPublicUrl(fileName);

      const type = file.type.startsWith("video") ? "video" : "image";
      const { error: dbError } = await supabase
        .from("media_items")
        .insert([{ url: publicUrl, type: type, duration: 10 }]);

      if (dbError) throw dbError;

      alert("อัปโหลดสำเร็จ!");
      setFile(null);

      // Reset file input
      const fileInput = document.getElementById(
        "dash-file-input",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      fetchMedia();
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
      if (fileName) {
        await supabase.storage.from("kiosk-media").remove([fileName]);
      }

      const { error } = await supabase
        .from("media_items")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setMediaList(mediaList.filter((item) => item.id !== id));
    } catch (error: any) {
      alert("ลบไม่สำเร็จ: " + error.message);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="dash-loading">
        <div className="kiosk-spinner" />
        <span style={{ fontSize: "0.875rem" }}>กำลังตรวจสอบสิทธิ์...</span>
      </div>
    );
  }

  return (
    <div className="dash-page">
      {/* ===== Header ===== */}
      <header className="dash-header">
        <div className="dash-logo">
          <div className="dash-logo-icon">🖥️</div>
          <span className="dash-logo-text">Kiosk Admin</span>
        </div>
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
      </header>

      {/* ===== Content ===== */}
      <div className="dash-content">
        {/* Upload Section */}
        <div className="dash-upload-section">
          <div className="dash-section-title">
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

          <div className="dash-upload-row">
            <input
              id="dash-file-input"
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="dash-file-input"
            />
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="dash-upload-btn"
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
                  กำลังอัปโหลด...
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

          {/* File Preview Tag */}
          {file && (
            <div className="dash-file-tag">
              <span>{file.type.startsWith("video") ? "🎬" : "🖼️"}</span>
              <span>
                <strong>{file.name}</strong> —{" "}
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          )}
        </div>

        {/* Media Grid Section */}
        <div className="dash-grid-header">
          <div className="dash-grid-title">รายการสื่อทั้งหมด</div>
          <div className="dash-grid-count">{mediaList.length} รายการ</div>
        </div>

        {mediaList.length === 0 ? (
          <div className="dash-empty">
            <div className="dash-empty-icon">📭</div>
            <div className="dash-empty-text">
              ยังไม่มีสื่อ — เริ่มอัปโหลดได้เลย
            </div>
          </div>
        ) : (
          <div className="dash-grid">
            {mediaList.map((item) => (
              <div key={item.id} className="dash-media-card">
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

                {/* Type Badge */}
                <div className="dash-media-type">
                  {item.type === "video" ? "🎬 Video" : "🖼️ Image"}
                </div>

                {/* Delete Overlay */}
                <div className="dash-media-overlay">
                  <button
                    onClick={() => handleDelete(item.id, item.url)}
                    className="dash-delete-btn"
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
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
