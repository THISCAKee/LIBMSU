import type { Metadata } from "next";
import { Anuphan } from "next/font/google"; // Import font
import "./globals.css";

// กำหนด Font Anuphan
const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  variable: "--font-anuphan",
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Kiosk Display",
  description: "Vertical Signage System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={anuphan.variable}>
      <body className={`${anuphan.className} antialiased bg-black text-white`}>
        {children}
      </body>
    </html>
  );
}
