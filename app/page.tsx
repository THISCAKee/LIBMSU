"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

const CROSSFADE_MS = 2000; // ระยะเวลา crossfade (ms)

// กำหนด Type ของข้อมูล
interface MediaItem {
  id: number;
  url: string;
  type: "image" | "video";
  duration: number;
}

// สถานะ transition ของแต่ละ slide
type SlidePhase = "enter" | "active" | "exit" | "hidden";

export default function KioskPage() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState<SlidePhase>("active");
  const [prevPhase, setPrevPhase] = useState<SlidePhase>("hidden");
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fullscreen toggle
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

  // ซิงค์ state กับ fullscreen event
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Auto-hide ปุ่มหลัง 3 วินาที, แสดงเมื่อมีการขยับเมาส์/แตะหน้าจอ
  useEffect(() => {
    const showAndHide = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    showAndHide(); // เริ่มต้น
    window.addEventListener("mousemove", showAndHide);
    window.addEventListener("touchstart", showAndHide);
    return () => {
      window.removeEventListener("mousemove", showAndHide);
      window.removeEventListener("touchstart", showAndHide);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // ดึงข้อมูลเมื่อเริ่มโหลดหน้าเว็บ
  useEffect(() => {
    const fetchMedia = async () => {
      const { data, error } = await supabase
        .from("media_items")
        .select("*")
        .order("created_at", { ascending: true });

      if (data) setMediaList(data as MediaItem[]);
      if (error) console.error("Error fetching media:", error);
    };
    fetchMedia();

    const interval = setInterval(fetchMedia, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ฟังก์ชันเปลี่ยน slide พร้อม crossfade + zoom
  const nextSlide = useCallback(() => {
    // เคลียร์ timers เก่า
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);

    // ตั้งค่า: ภาพเก่าเริ่ม exit, ภาพใหม่เริ่ม enter
    setPrevIndex(currentIndex);
    setPrevPhase("exit");
    setCurrentIndex((prev) => (prev + 1) % mediaList.length);
    setCurrentPhase("enter");
    setProgress(0);

    // หลัง 1 frame — สั่ง animate เข้า (ต้อง delay เพื่อให้ browser paint state เริ่มต้นก่อน)
    enterTimerRef.current = setTimeout(() => {
      setCurrentPhase("active");
    }, 50);

    // หลัง crossfade จบ — cleanup ภาพเก่า
    transitionTimerRef.current = setTimeout(() => {
      setPrevIndex(null);
      setPrevPhase("hidden");
    }, CROSSFADE_MS + 100);
  }, [currentIndex, mediaList.length]);

  // logic เปลี่ยน slide + Progress Bar
  useEffect(() => {
    if (mediaList.length === 0) return;

    const currentItem = mediaList[currentIndex];

    if (progressRef.current) {
      cancelAnimationFrame(progressRef.current);
    }

    if (currentItem.type === "image") {
      const durationMs = currentItem.duration * 2000;
      startTimeRef.current = performance.now();

      const updateProgress = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const pct = Math.min((elapsed / durationMs) * 100, 100);
        setProgress(pct);

        if (pct >= 100) {
          nextSlide();
        } else {
          progressRef.current = requestAnimationFrame(updateProgress);
        }
      };
      progressRef.current = requestAnimationFrame(updateProgress);

      return () => {
        if (progressRef.current) cancelAnimationFrame(progressRef.current);
      };
    }
  }, [currentIndex, mediaList, nextSlide]);

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    };
  }, []);

  // ===== Style helper ตาม phase =====
  const getSlideStyle = (
    phase: SlidePhase,
    zIndex: number,
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

    switch (phase) {
      case "enter":
        // เริ่มต้น: ซ่อนอยู่ ย่อเล็กน้อย + blur
        return {
          ...base,
          opacity: 0,
          transform: "scale(1.04)",
          filter: "blur(4px)",
        };
      case "active":
        // animate เข้า: แสดงเต็ม ขนาดปกติ ชัด
        return {
          ...base,
          opacity: 1,
          transform: "scale(1)",
          filter: "blur(0px)",
        };
      case "exit":
        // animate ออก: จางหาย ขยายเล็กน้อย + blur
        return {
          ...base,
          opacity: 0,
          transform: "scale(0.97)",
          filter: "blur(6px)",
        };
      case "hidden":
      default:
        return {
          ...base,
          opacity: 0,
          transform: "scale(1)",
          filter: "blur(0px)",
        };
    }
  };

  // ===== Loading =====
  if (mediaList.length === 0) {
    return (
      <div className="kiosk-loading">
        <div className="kiosk-spinner" />
        <span className="kiosk-loading-text">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  const currentItem = mediaList[currentIndex];
  const prevItem = prevIndex !== null ? mediaList[prevIndex] : null;

  // ===== Render =====
  const renderSlide = (
    item: MediaItem,
    phase: SlidePhase,
    zIndex: number,
    isCurrent: boolean,
  ) => {
    const style = getSlideStyle(phase, zIndex);

    if (item.type === "image") {
      return (
        <img
          key={`slide-${item.id}-${isCurrent ? "cur" : "prev"}`}
          src={item.url}
          alt="Kiosk Slide"
          style={style}
          draggable={false}
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
        onTimeUpdate={isCurrent ? handleVideoTimeUpdate : undefined}
        onEnded={isCurrent ? nextSlide : undefined}
      />
    );
  };

  return (
    <div className="kiosk-container" ref={containerRef}>
      {/* Layer 1: ภาพเก่า — exit */}
      {prevItem && renderSlide(prevItem, prevPhase, 1, false)}

      {/* Layer 2: ภาพปัจจุบัน — enter → active */}
      {renderSlide(currentItem, currentPhase, 2, true)}

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className={`kiosk-fullscreen-btn ${showControls ? "visible" : ""}`}
        title={isFullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}
      >
        {isFullscreen ? (
          // ไอคอน Exit Fullscreen
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
          // ไอคอน Enter Fullscreen
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

      {/* Slide Indicator Dots */}
      {mediaList.length > 1 && (
        <div className="kiosk-dots">
          {mediaList.map((_, idx) => (
            <div
              key={idx}
              className={`kiosk-dot ${idx === currentIndex ? "active" : ""}`}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      <div className="kiosk-progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}
