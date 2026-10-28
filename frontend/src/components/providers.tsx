"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { StoreAccessGate } from "@/features/store-profile/store-access-gate";
import { I18nProvider } from "@/lib/i18n/i18n-provider";
import type { Locale } from "@/lib/i18n/locales";
import type { MessageTree } from "@/lib/i18n/translate";

export function Providers({ locale, seed, children }: {
  locale: Locale; seed: Record<string, MessageTree>; children: React.ReactNode;
}) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <I18nProvider initialLocale={locale} seed={seed}>
      <QueryClientProvider client={client}>
        {children}
        {/* Sau đăng nhập: thông báo gian hàng bảo lưu + bắt buộc đồng ý Điều khoản sử dụng */}
        <StoreAccessGate />
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </I18nProvider>
  );
}
