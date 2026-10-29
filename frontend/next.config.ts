import type { NextConfig } from "next";

/**
 * Content-Security-Policy cho mọi trang. 'unsafe-inline' cho script: Next chèn script nội tuyến (__next_f) + script áp màu
 * chủ đề trong <head>, không dùng nonce (trang tĩnh). Ảnh: data:/blob: (logo, mã VietQR sinh tại chỗ) + https: (ảnh hàng
 * hóa có thể là URL ngoài). In dùng iframe cùng nguồn (about:blank) → frame-src 'self'. Dev cần 'unsafe-eval' (React refresh).
 * HSTS đặt ở middleware (chỉ khi cookie secure + https, đọc biến môi trường lúc chạy).
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      // Màn bán hàng đã đổi đường dẫn /pos → /sale (giống KiotViet). Giữ redirect vĩnh viễn để bookmark cũ vẫn mở được;
      // query (?edit=, ?return=, ?order=, ?orderInvoice=, ?copy=) được Next giữ nguyên khi chuyển hướng.
      { source: "/pos", destination: "/sale", permanent: true },
    ];
  },
};

export default nextConfig;
