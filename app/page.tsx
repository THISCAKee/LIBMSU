"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  MediaSlideshow,
  type MediaItem,
} from "@/components/MediaSlideshow";
import { supabase } from "@/lib/supabaseClient";

const KIOSK_LIST = ["kiosk-1", "kiosk-2", "kiosk-3", "kiosk-SPACE"];
type DisplayMode = "3row" | "single";

// ===== Row Wrapper =====
function KioskRow({ items }: { items: MediaItem[] }) {
  return (
    <div className="kiosk-row">
      <MediaSlideshow items={items} />
    </div>
  );
}

// ===== Mode Toggle Icon =====
function ModeIcon({ mode }: { mode: DisplayMode }) {
  if (mode === "3row") {
    // Icon: 3 horizontal bars → click to switch to single
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="5" rx="1" />
        <rect x="3" y="10" width="18" height="4" rx="1" />
        <rect x="3" y="16" width="18" height="5" rx="1" />
      </svg>
    );
  }
  // Icon: single tall page → click to switch to 3row
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="2" width="12" height="20" rx="2" />
    </svg>
  );
}

// ===== Main Kiosk Page =====
export default function KioskPage() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedKiosk, setSelectedKiosk] = useState<string>("kiosk-1");
  const [showSelector, setShowSelector] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("3row");
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const showAndHide = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    };
    showAndHide();
    window.addEventListener("mousemove", showAndHide);
    window.addEventListener("touchstart", showAndHide);
    return () => {
      window.removeEventListener("mousemove", showAndHide);
      window.removeEventListener("touchstart", showAndHide);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // โหลด Kiosk จาก LocalStorage
  useEffect(() => {
    const savedKiosk = localStorage.getItem("selected_kiosk");
    if (savedKiosk && KIOSK_LIST.includes(savedKiosk)) {
      setSelectedKiosk(savedKiosk);
    }
  }, []);

  const changeKiosk = (k: string) => {
    setSelectedKiosk(k);
    localStorage.setItem("selected_kiosk", k);
    setShowSelector(false);
  };

  useEffect(() => {
    const fetchAll = async () => {
      // Fetch media items
      let { data, error } = await supabase
        .from("media_items")
        .select("*")
        .eq("kiosk_id", selectedKiosk)
        .order("row_slot", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error && error.message.includes("kiosk_id")) {
        const fallback = await supabase
          .from("media_items")
          .select("*")
          .order("created_at", { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (data) {
        const normalized = data
          .map((item) => ({
            ...item,
            row_slot: (item.row_slot as number) || 1,
            is_active: item.is_active !== false,
            kiosk_id: item.kiosk_id || "kiosk-1",
          }))
          .filter(
            (item) =>
              item.is_active &&
              (item.kiosk_id === selectedKiosk ||
                (!item.kiosk_id && selectedKiosk === "kiosk-1")),
          ) as MediaItem[];
        setMediaList(normalized);
      }
      if (error) console.error("Error fetching media:", error);

      // Fetch display mode from kiosk_settings
      const { data: settings, error: settingsError } = await supabase
        .from("kiosk_settings")
        .select("display_mode")
        .eq("kiosk_id", selectedKiosk)
        .maybeSingle();

      if (settingsError) {
        console.warn(
          "kiosk_settings table may not exist yet. Run SQL to create it.\n" +
            settingsError.message,
        );
        // Keep current displayMode unchanged — don't reset to 3row
      } else if (
        settings?.display_mode === "single" ||
        settings?.display_mode === "3row"
      ) {
        setDisplayMode(settings.display_mode);
      } else if (settings === null) {
        // Row doesn't exist yet for this kiosk — default to 3row
        setDisplayMode("3row");
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 30 * 1000); // poll every 30s
    return () => clearInterval(interval);
  }, [selectedKiosk]);

  // Filter by display_mode_filter before splitting into rows
  const visibleMedia = mediaList.filter((m) => {
    const f =
      (m as MediaItem & { display_mode_filter?: string }).display_mode_filter ||
      "both";
    return f === "both" || f === displayMode;
  });

  const { row1, row2, row3, allItems } = (function () {
    const r1 = visibleMedia.filter((m) => m.row_slot === 1);
    const r2 = visibleMedia.filter((m) => m.row_slot === 2);
    const r3 = visibleMedia.filter((m) => m.row_slot === 3);
    return {
      row1: r1,
      row2: r2,
      row3: r3,
      allItems: [...r1, ...r2, ...r3],
    };
  })();

  const controlsStyle: React.CSSProperties = {
    opacity: showControls ? 1 : 0,
    transition: "opacity 0.3s",
    pointerEvents: showControls ? "auto" : "none",
  };

  return (
    <div
      className={`kiosk-container ${displayMode === "single" ? "kiosk-single" : ""}`}
      ref={containerRef}
    >
      {/* ===== Display: 3-Row mode ===== */}
      {displayMode === "3row" && (
        <>
          <KioskRow items={row1} />
          <KioskRow items={row2} />
          <KioskRow items={row3} />
        </>
      )}

      {/* ===== Display: Single fullscreen mode ===== */}
      {displayMode === "single" && (
        <div className="kiosk-row" style={{ flex: "1 1 100%" }}>
          <MediaSlideshow items={allItems} />
        </div>
      )}

      {/* ===== Controls overlay ===== */}

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className={`kiosk-fullscreen-btn ${showControls ? "visible" : ""}`}
        title={isFullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}
      >
        {isFullscreen ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        )}
      </button>

      {/* Kiosk Selector Button */}
      {!isFullscreen && (
        <button
          onClick={() => setShowSelector(!showSelector)}
          className={`kiosk-selector-btn ${showControls ? "visible" : ""}`}
          title="เลือก Kiosk"
          style={{
            ...controlsStyle,
            position: "absolute",
            top: "1rem",
            right: "1rem",
            zIndex: 60,
            background: "rgba(0,0,0,0.5)",
            color: "white",
            border: "none",
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            backdropFilter: "blur(4px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontFamily: "'Prompt', sans-serif",
          }}
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
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          {selectedKiosk.toUpperCase()}
        </button>
      )}

      {/* Selector Modal */}
      {!isFullscreen && showSelector && (
        <div
          style={{
            position: "absolute",
            top: "4rem",
            right: "1rem",
            zIndex: 60,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(10px)",
            padding: "1rem",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            color: "#333",
            fontFamily: "'Prompt', sans-serif",
          }}
        >
          <h4
            style={{
              margin: "0 0 0.5rem 0",
              fontSize: "0.9rem",
              color: "#666",
            }}
          >
            เลือก Kiosk เพื่อแสดงผล
          </h4>
          {KIOSK_LIST.map((k) => (
            <button
              key={k}
              onClick={() => changeKiosk(k)}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                border: "none",
                background: selectedKiosk === k ? "#3b82f6" : "#f1f5f9",
                color: selectedKiosk === k ? "white" : "#333",
                fontWeight: selectedKiosk === k ? "bold" : "normal",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
              }}
            >
              • {k.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => setShowSelector(false)}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem",
              background: "transparent",
              border: "none",
              color: "#666",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            ปิด
          </button>
        </div>
      )}
    </div>
  );
}
