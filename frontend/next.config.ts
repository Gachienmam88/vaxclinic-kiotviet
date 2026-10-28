import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Màn bán hàng đã đổi đường dẫn /pos → /sale (giống KiotViet). Giữ redirect vĩnh viễn để bookmark cũ vẫn mở được;
      // query (?edit=, ?return=, ?order=, ?orderInvoice=, ?copy=) được Next giữ nguyên khi chuyển hướng.
      { source: "/pos", destination: "/sale", permanent: true },
    ];
  },
};

export default nextConfig;
