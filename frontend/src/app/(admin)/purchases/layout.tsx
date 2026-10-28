import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Mua hàng (nhập hàng, trả hàng nhập, nhà cung cấp, hóa đơn đầu vào): gửi sẵn bản dịch "purchases" cho lần tải đầu. */
export default function PurchasesLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["purchases"]}>{children}</I18nPreload>;
}
