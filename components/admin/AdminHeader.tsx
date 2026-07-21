import styles from "./AdminStudio.module.css";

interface AdminHeaderProps {
  selectedKiosk: string;
  isTvKiosk: boolean;
  previewHref: string;
  onLogout: () => void;
}

export function AdminHeader({
  selectedKiosk,
  isTvKiosk,
  previewHref,
  onLogout,
}: AdminHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brandBlock}>
        <span className={styles.brandMark} aria-hidden="true">
          MS
        </span>
        <div>
          <p className={styles.eyebrow}>LIBMSU DISPLAY SYSTEM</p>
          <h1 className={styles.pageTitle}>Media Studio</h1>
        </div>
      </div>

      <div className={styles.headerContext}>
        <div className={styles.currentScreen}>
          <span>กำลังจัดการ</span>
          <strong>{selectedKiosk.toUpperCase()}</strong>
          <small>{isTvKiosk ? "TV 16:9" : "Kiosk display"}</small>
        </div>
        <a
          className={styles.secondaryButton}
          href={previewHref}
          target="_blank"
          rel="noreferrer"
        >
          ดูตัวอย่าง
          <span aria-hidden="true">↗</span>
        </a>
        <button
          className={styles.ghostButton}
          type="button"
          onClick={onLogout}
        >
          ออกจากระบบ
        </button>
      </div>
    </header>
  );
}
