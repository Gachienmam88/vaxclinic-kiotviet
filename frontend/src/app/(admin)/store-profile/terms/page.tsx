"use client";

import { ProfileCard } from "@/features/store-profile/store-profile-shell";
import { TermsOfUseView } from "@/features/store-profile/terms-of-use-view";
import { useTermsStatus } from "@/features/store-profile/terms-queries";
import { formatDateTime } from "@/lib/format";

/** Hồ sơ cửa hàng → Điều khoản sử dụng: nội dung + thời điểm user hiện tại đã đồng ý. */
export default function TermsPage() {
  const { data } = useTermsStatus();
  return (
    <ProfileCard className="px-6 py-5">
      {data?.acceptedAt && (
        <p className="mb-3 text-xs text-muted-foreground">Bạn đã đồng ý phiên bản {data.version} lúc {formatDateTime(data.acceptedAt)}.</p>
      )}
      <TermsOfUseView />
    </ProfileCard>
  );
}
