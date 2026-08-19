import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "../components/Sidebar";
import ProgressProvider from "../components/ProgressProvider";
import AuthUserProvider from "../components/AuthUserProvider";
import ProfileProvider from "../components/ProfileProvider";
import InitialDataProvider from "../components/InitialDataProvider";

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
        <AuthUserProvider>
          <InitialDataProvider>
            <ProfileProvider>
              <ProgressProvider>
                <Sidebar />
                {children}
              </ProgressProvider>
            </ProfileProvider>
          </InitialDataProvider>
        </AuthUserProvider>
      </body>
    </html>
  );
}
