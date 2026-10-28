"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/use-current-user";

/** Tổng quan — sẽ thay bằng dashboard doanh thu / số mũi tiêm ở phase báo cáo. */
export default function DashboardPage() {
  const { data: me } = useCurrentUser();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Xin chào, {me?.user.fullName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>Vai trò: {me?.user.roleName}</p>
        <p>Điểm tiêm làm việc: {me?.user.branches.map((b) => b.name).join(", ")}</p>
      </CardContent>
    </Card>
  );
}
