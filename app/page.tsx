"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

const CROSSFADE_MS = 2000;

interface MediaItem {
  id: number;
  url: string;
  type: "image" | "video";
  duration: number;
  row_slot: 1 | 2 | 3;
  kiosk_id: string;
}

const KIOSK_LIST = ["kiosk-1", "kiosk-2", "kiosk-3", "kiosk-4"];

type SlidePhase = "enter" | "active" | "exit" | "hidden";

// ===== Single Row Slideshow Component =====
function RowSlideshow({ items }: { items: MediaItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState<SlidePhase>("active");
  const [prevPhase, setPrevPhase] = useState<SlidePhase>("hidden");

  const videoRef = useRef<HTMLVideoElement>(null);
  const durationTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextSlide = useCallback(() => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);

    setPrevIndex(currentIndex);
    setPrevPhase("exit");
    setCurrentIndex((prev) => (prev + 1) % items.length);
    setCurrentPhase("enter");

    enterTimerRef.current = setTimeout(() => {
      setCurrentPhase("active");
    }, 50);

    transitionTimerRef.current = setTimeout(() => {
      setPrevIndex(null);
      setPrevPhase("hidden");
    }, CROSSFADE_MS + 100);
  }, [currentIndex, items.length]);

  // Auto-advance for images; videos advance via onEnded
  useEffect(() => {
    if (items.length === 0) return;
    const currentItem = items[currentIndex];

    if (durationTimerRef.current) clearTimeout(durationTimerRef.current);

    if (currentItem.type === "video") {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
      return;
    }

    // Image: advance after duration
    if (items.length > 1) {
      const ms = currentItem.duration * 1000;
      durationTimerRef.current = window.setTimeout(nextSlide, ms);
    }

    return () => {
      if (durationTimerRef.current) clearTimeout(durationTimerRef.current);
    };
  }, [currentIndex, items, nextSlide]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (durationTimerRef.current) clearTimeout(durationTimerRef.current);
    };
  }, []);

  const getSlideStyle = (
    phase: SlidePhase,
    zIndex: number,
    isVideo: boolean,
  ): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "contain",
      objectPosition: "center",
      background: "#000",
      zIndex,
      willChange: "opacity, transform, filter",
      transition: [
        `opacity ${CROSSFADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        `transform ${CROSSFADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        `filter ${CROSSFADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      ].join(", "),
    };
    const blur = (px: number) => (isVideo ? "blur(0px)" : `blur(${px}px)`);

    switch (phase) {
      case "enter":
        return {
          ...base,
          opacity: 0,
          transform: "scale(1.02)",
          filter: blur(4),
        };
      case "active":
        return { ...base, opacity: 1, transform: "scale(1)", filter: blur(0) };
      case "exit":
        return {
          ...base,
          opacity: 0,
          transform: "scale(0.98)",
          filter: blur(6),
        };
      case "hidden":
      default:
        return { ...base, opacity: 0, transform: "scale(1)", filter: blur(0) };
    }
  };

  const renderSlide = (
    item: MediaItem,
    phase: SlidePhase,
    zIndex: number,
    isCurrent: boolean,
  ) => {
    const style = getSlideStyle(phase, zIndex, item.type === "video");
    if (item.type === "image") {
      return (
        <Image
          key={`slide-${item.id}-${isCurrent ? "cur" : "prev"}`}
          src={item.url}
          alt="Kiosk Slide"
          fill
          sizes="100vw"
          style={style}
          draggable={false}
          priority={isCurrent}
        />
      );
    }
    return (
      <video
        key={`slide-${item.id}-${isCurrent ? "cur" : "prev"}`}
        ref={isCurrent ? videoRef : undefined}
        src={item.url}
        autoPlay={isCurrent}
        muted
        playsInline
        style={style}
        onEnded={isCurrent && items.length > 1 ? nextSlide : undefined}
      />
    );
  };

  if (items.length === 0) {
    return (
      <div className="row-empty">
        <span>ยังไม่มีสื่อในช่องนี้</span>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const prevItem = prevIndex !== null ? items[prevIndex] : null;

  return (
    <div className="row-slideshow">
      {prevItem && renderSlide(prevItem, prevPhase, 1, false)}
      {renderSlide(currentItem, currentPhase, 2, true)}
      {/* Slide indicator dots */}
      {items.length > 1 && (
        <div className="row-dots">
          {items.map((_, idx) => (
            <div
              key={idx}
              className={`row-dot ${idx === currentIndex ? "active" : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Row Wrapper =====
function KioskRow({ items }: { items: MediaItem[] }) {
  return (
    <div className="kiosk-row">
      <RowSlideshow items={items} />
    </div>
  );
}

// ===== Main Kiosk Page =====
export default function KioskPage() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedKiosk, setSelectedKiosk] = useState<string>("kiosk-1");
  const [showSelector, setShowSelector] = useState(false);
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
    const saved = localStorage.getItem("selected_kiosk");
    if (saved && KIOSK_LIST.includes(saved)) {
      setSelectedKiosk(saved);
    }
  }, []);

  const changeKiosk = (k: string) => {
    setSelectedKiosk(k);
    localStorage.setItem("selected_kiosk", k);
    setShowSelector(false);
  };

  useEffect(() => {
    const fetchMedia = async () => {
      let { data, error } = await supabase
        .from("media_items")
        .select("*")
        .eq("kiosk_id", selectedKiosk)
        .order("created_at", { ascending: true });

      if (error && error.message.includes("kiosk_id")) {
        // Fallback if kiosk_id column doesn't exist yet
        const fallback = await supabase
          .from("media_items")
          .select("*")
          .order("created_at", { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (data) {
        // Fallback ถ้ายังไม่มี kiosk_id แต่ดึงมาได้ (กรณี error fallback ตอนอัปโหลด)
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
    };

    // ดึงข้อมูลครั้งแรก
    fetchMedia();

    // ดึงใหม่ทุกๆ 1 นาที (หรือตามต้องการ)
    const interval = setInterval(fetchMedia, 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedKiosk]);

  const row1 = mediaList.filter((m) => m.row_slot === 1);
  const row2 = mediaList.filter((m) => m.row_slot === 2);
  const row3 = mediaList.filter((m) => m.row_slot === 3);

  return (
    <div className="kiosk-container" ref={containerRef}>
      <KioskRow items={row1} />
      <KioskRow items={row2} />
      <KioskRow items={row3} />

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
            opacity: showControls ? 1 : 0,
            transition: "opacity 0.3s",
            pointerEvents: showControls ? "auto" : "none",
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
