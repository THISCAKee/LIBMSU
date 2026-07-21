"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeSlideIndex } from "@/lib/slideshow";

const CROSSFADE_MS = 2000;

export interface MediaItem {
  id: number;
  url: string;
  type: "image" | "video";
  duration: number;
  row_slot: 1 | 2 | 3;
  kiosk_id: string;
  sort_order?: number;
}

type SlidePhase = "enter" | "active" | "exit" | "hidden";

interface MediaSlideshowProps {
  items: MediaItem[];
  emptyMessage?: string;
}

export function MediaSlideshow({
  items,
  emptyMessage = "ยังไม่มีสื่อในช่องนี้",
}: MediaSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState<SlidePhase>("active");
  const [prevPhase, setPrevPhase] = useState<SlidePhase>("hidden");

  const videoRef = useRef<HTMLVideoElement>(null);
  const durationTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextSlide = useCallback(() => {
    const activeIndex = normalizeSlideIndex(currentIndex, items.length);
    if (activeIndex === null) return;

    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);

    setPrevIndex(activeIndex);
    setPrevPhase("exit");
    setCurrentIndex((activeIndex + 1) % items.length);
    setCurrentPhase("enter");

    enterTimerRef.current = setTimeout(() => {
      setCurrentPhase("active");
    }, 50);

    transitionTimerRef.current = setTimeout(() => {
      setPrevIndex(null);
      setPrevPhase("hidden");
    }, CROSSFADE_MS + 100);
  }, [currentIndex, items.length]);

  const safeCurrentIndex = normalizeSlideIndex(currentIndex, items.length);
  const currentItem =
    safeCurrentIndex === null ? null : items[safeCurrentIndex];

  useEffect(() => {
    if (!currentItem) return;

    if (durationTimerRef.current) clearTimeout(durationTimerRef.current);

    if (currentItem.type === "video") {
      if (
        videoRef.current &&
        (videoRef.current.paused || videoRef.current.ended)
      ) {
        videoRef.current.play().catch((err) => {
          console.error("Video play error:", err);
        });
      }
      return;
    }

    if (items.length > 1) {
      durationTimerRef.current = window.setTimeout(
        nextSlide,
        currentItem.duration * 1000,
      );
    }

    return () => {
      if (durationTimerRef.current) clearTimeout(durationTimerRef.current);
    };
  }, [currentIndex, currentItem?.id, items.length, nextSlide]);

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
    const blur = (px: number) =>
      isVideo ? "blur(0px)" : `blur(${px}px)`;

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

    const handleVideoEnded = isCurrent
      ? () => {
          if (items.length > 1) {
            nextSlide();
          } else if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
          }
        }
      : undefined;

    return (
      <video
        key={`slide-${item.id}-${isCurrent ? "cur" : "prev"}`}
        ref={isCurrent ? videoRef : undefined}
        src={item.url}
        autoPlay={isCurrent}
        muted
        playsInline
        style={style}
        onEnded={handleVideoEnded}
        onError={isCurrent && items.length > 1 ? nextSlide : undefined}
      />
    );
  };

  if (!currentItem || safeCurrentIndex === null) {
    return (
      <div className="row-empty">
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const prevItem = prevIndex !== null ? items[prevIndex] : null;

  return (
    <div className="row-slideshow">
      {prevItem && renderSlide(prevItem, prevPhase, 1, false)}
      {renderSlide(currentItem, currentPhase, 2, true)}
      {items.length > 1 && (
        <div className="row-dots">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`row-dot ${idx === safeCurrentIndex ? "active" : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
