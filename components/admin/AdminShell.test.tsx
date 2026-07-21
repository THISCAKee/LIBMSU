import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminHeader } from "./AdminHeader";
import { ScreenSwitcher } from "./ScreenSwitcher";

describe("Admin shell", () => {
  it("renders the selected display and preview destination", () => {
    const html = renderToStaticMarkup(
      <AdminHeader
        selectedKiosk="kiosk-TV"
        isTvKiosk
        previewHref="/tv"
        onLogout={() => {}}
      />,
    );

    expect(html).toContain("Media Studio");
    expect(html).toContain("KIOSK-TV");
    expect(html).toContain('href="/tv"');
  });

  it("hides display modes for TV", () => {
    const html = renderToStaticMarkup(
      <ScreenSwitcher
        kiosks={["kiosk-1", "kiosk-TV"]}
        selectedKiosk="kiosk-TV"
        mediaCounts={{ "kiosk-1": 2, "kiosk-TV": 4 }}
        displayMode="3row"
        isSavingMode={false}
        onSelectKiosk={() => {}}
        onSelectMode={() => {}}
      />,
    );

    expect(html).toContain("TV");
    expect(html).toContain("4");
    expect(html).not.toContain("3 แถว");
    expect(html).not.toContain("หน้าเดี่ยว");
  });
});
