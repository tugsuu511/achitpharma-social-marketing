import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Achitpharma · Social Marketing Team", description: "Ачитаар дүүрэн санаа. Нэг баг, нэг орон зай. Ажил төлөвлөх, гүйцэтгэл хянах багийн систем.", icons: { icon: { url: "/brand/achitpharma-logo.png", type: "image/png" } } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#174c3c" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="mn"><body>{children}</body></html>; }
