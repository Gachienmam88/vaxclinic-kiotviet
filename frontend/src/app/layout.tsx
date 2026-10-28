import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Inter ships a Vietnamese subset so diacritics render with the same font.
const inter = Inter({ variable: "--font-sans", subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "VaxClinic",
  description: "Quản lý kinh doanh vắc xin và dịch vụ tiêm chủng",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
