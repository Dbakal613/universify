import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "../components/Sidebar";
import ProgressProvider from "../components/ProgressProvider";

export const metadata: Metadata = {
  title: "Universify",
  description: "Tu copiloto universitario",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <ProgressProvider>
          <Sidebar />
          {children}
        </ProgressProvider>
      </body>
    </html>
  );
}
