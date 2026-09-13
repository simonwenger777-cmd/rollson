import type { Metadata } from "next";
import { LanguageProvider } from "@/lib/language";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rollson - Secure Mail Query",
  description: "Secure mail query system with CD key access control for verification codes",
  icons: {
    icon: "/site-icon.png",
    shortcut: "/site-icon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark-mode" suppressHydrationWarning>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
