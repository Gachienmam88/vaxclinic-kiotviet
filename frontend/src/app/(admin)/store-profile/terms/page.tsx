"use client";

import { ProfileCard } from "@/features/store-profile/store-profile-shell";
import { TermsOfUseView } from "@/features/store-profile/terms-of-use-view";
import { useTermsStatus } from "@/features/store-profile/terms-queries";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { storeProfileNs } from "@/messages/store-profile";

/** Hồ sơ cửa hàng → Điều khoản sử dụng: nội dung + thời điểm user hiện tại đã đồng ý. */
export default function TermsPage() {
  const { data } = useTermsStatus();
  const t = useT(storeProfileNs);
  return (
    <ProfileCard className="px-6 py-5">
      {data?.acceptedAt && (
        <p className="mb-3 text-xs text-muted-foreground">{t("terms.acceptedAt", { version: data.version, time: formatDateTime(data.acceptedAt) })}</p>
      )}
      <TermsOfUseView />
    </ProfileCard>
  );
}
