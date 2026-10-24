import type { Metadata } from "next";
import { AntdProvider } from "@/components/antd-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS F&B - Bán Hàng Quán Ăn, Cafe",
  description: "Hệ thống POS bán hàng F&B chuyên nghiệp, tối ưu màn hình cảm ứng",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
