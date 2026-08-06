"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaSlideshow, type MediaItem } from "@/components/MediaSlideshow";
import type { TvKioskId } from "@/lib/displayChannels";
import {
  createTvMediaQuery,
  normalizeTvMedia,
  type TvMediaRow,
} from "@/lib/tvMedia";
import { supabase } from "@/lib/supabaseClient";

const POLL_INTERVAL_MS = 30_000;

interface TvDisplayProps {
  kioskId: TvKioskId;
  channelLabel: string;
}

export function TvDisplay({ kioskId, channelLabel }: TvDisplayProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMedia = useCallback(async () => {
    const { data, error } = await createTvMediaQuery(supabase, kioskId);

    if (error) {
      console.error(`Error fetching ${channelLabel} media:`, error);
      setLoadError(true);
      setLoading(false);
      return;
    }

    setMediaList(normalizeTvMedia((data ?? []) as TvMediaRow[], kioskId));
    setLoadError(false);
    setLoading(false);
  }, [channelLabel, kioskId]);

  useEffect(() => {
    fetchMedia();
    const interval = window.setInterval(fetchMedia, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchMedia]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const showAndHideControls = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    showAndHideControls();
    window.addEventListener("mousemove", showAndHideControls);
    window.addEventListener("touchstart", showAndHideControls);
    return () => {
      window.removeEventListener("mousemove", showAndHideControls);
      window.removeEventListener("touchstart", showAndHideControls);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  let displayContent: React.ReactNode;
  if (loading && mediaList.length === 0) {
    displayContent = (
      <div className="tv-display-state">
        <div className="kiosk-spinner" />
        <span>กำลังโหลดสื่อสำหรับ {channelLabel}</span>
      </div>
    );
  } else if (loadError && mediaList.length === 0) {
    displayContent = (
      <div className="tv-display-state tv-display-error">
        <span>ไม่สามารถโหลดสื่อสำหรับ {channelLabel}</span>
      </div>
    );
  } else {
    displayContent = (
      <MediaSlideshow
        items={mediaList}
        emptyMessage={`ยังไม่มีสื่อสำหรับ ${channelLabel}`}
      />
    );
  }

  return (
    <div className="tv-display-page" ref={containerRef}>
      <div className="tv-display-frame">{displayContent}</div>

      <button
        onClick={toggleFullscreen}
        className={`kiosk-fullscreen-btn ${showControls ? "visible" : ""}`}
        title={isFullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}
        aria-label={isFullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}
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
    </div>
  );
}
