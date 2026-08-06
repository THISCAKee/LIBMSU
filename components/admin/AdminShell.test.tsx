import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ADMIN_DISPLAY_IDS,
  previewHrefForKiosk,
} from "../../lib/displayChannels";
import { AdminHeader } from "./AdminHeader";
import { ScreenSwitcher } from "./ScreenSwitcher";

describe("Admin shell", () => {
  it("renders the selected display and preview destination", () => {
    const html = renderToStaticMarkup(
      <AdminHeader
        selectedKiosk="kiosk-TV"
        isTvKiosk
        previewHref="/tvA"
        onLogout={() => {}}
      />,
    );

    expect(html).toContain("Media Studio");
    expect(html).toContain("KIOSK-TV");
    expect(html).toContain('href="/tvA"');
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

    expect(html).toContain("TV A");
    expect(html).toContain("4");
    expect(html).not.toContain("3 แถว");
    expect(html).not.toContain("หน้าเดี่ยว");
  });

  it.each([
    ["kiosk-TV", "/tvA"],
    ["kiosk-TV-B", "/tvB"],
  ] as const)("renders %s with its preview route", (id, href) => {
    const header = renderToStaticMarkup(
      <AdminHeader
        selectedKiosk={id}
        isTvKiosk
        previewHref={previewHrefForKiosk(id)}
        onLogout={() => {}}
      />,
    );
    const switcher = renderToStaticMarkup(
      <ScreenSwitcher
        kiosks={ADMIN_DISPLAY_IDS}
        selectedKiosk={id}
        mediaCounts={{ [id]: 3 }}
        displayMode="3row"
        isSavingMode={false}
        onSelectKiosk={() => {}}
        onSelectMode={() => {}}
      />,
    );

    expect(header).toContain(`href="${href}"`);
    expect(header).toContain("TV 16:9");
    expect(switcher).toContain("TV A");
    expect(switcher).toContain("TV B");
    expect(switcher).not.toContain("3 แถว");
  });
});
