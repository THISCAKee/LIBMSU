import type { DisplayMode } from "./types";
import styles from "./AdminStudio.module.css";

interface ScreenSwitcherProps {
  kiosks: readonly string[];
  selectedKiosk: string;
  mediaCounts: Record<string, number>;
  displayMode: DisplayMode;
  isSavingMode: boolean;
  onSelectKiosk: (kioskId: string) => void;
  onSelectMode: (mode: DisplayMode) => void;
}

function kioskLabel(kiosk: string): string {
  if (kiosk === "kiosk-TV") return "TV";
  if (kiosk === "kiosk-SPACE") return "SPACE";
  return kiosk.replace("kiosk-", "Kiosk ");
}

export function ScreenSwitcher({
  kiosks,
  selectedKiosk,
  mediaCounts,
  displayMode,
  isSavingMode,
  onSelectKiosk,
  onSelectMode,
}: ScreenSwitcherProps) {
  const isTv = selectedKiosk === "kiosk-TV";

  return (
    <section className={styles.screenToolbar} aria-label="เลือกจอแสดงผล">
      <div className={styles.screenList} role="list">
        {kiosks.map((kiosk) => {
          const selected = kiosk === selectedKiosk;
          return (
            <button
              key={kiosk}
              type="button"
              className={
                selected ? styles.screenActive : styles.screenButton
              }
              aria-pressed={selected}
              onClick={() => onSelectKiosk(kiosk)}
            >
              <span>{kioskLabel(kiosk)}</span>
              <strong aria-label={`${mediaCounts[kiosk] ?? 0} รายการ`}>
                {mediaCounts[kiosk] ?? 0}
              </strong>
            </button>
          );
        })}
      </div>

      {!isTv && (
        <div className={styles.modeSwitch} aria-label="โหมดแสดงผล">
          <span>รูปแบบจอ</span>
          {(["3row", "single"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={displayMode === mode}
              disabled={isSavingMode}
              onClick={() => onSelectMode(mode)}
            >
              {mode === "3row" ? "3 แถว" : "หน้าเดี่ยว"}
            </button>
          ))}
          {isSavingMode && <small role="status">กำลังบันทึก</small>}
        </div>
      )}
    </section>
  );
}
