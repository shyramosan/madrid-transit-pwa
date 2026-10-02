import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Madrid Transit Lab",
  description: "Prototipo PWA de transporte en tiempo real para Alcobendas, Sanse y Madrid",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
