"use client";

import { useEffect, useState } from "react";
import type { BranchRef } from "@/lib/use-current-user";
import { load, save } from "./sale-storage";

const key = (userId: string) => `sale.branch.${userId}`;

/**
 * Chi nhánh đang bán của màn bán hàng: chỉ các chi nhánh người dùng được phân công, nhớ lựa chọn trên máy theo người dùng.
 * Đổi chi nhánh → danh mục (tồn kho, bảng giá) tải lại theo chi nhánh mới; giỏ hàng các tab giữ nguyên.
 */
export function useSaleBranch(userId: string | undefined, branches: BranchRef[]) {
  const [picked, setPicked] = useState("");
  useEffect(() => {
    if (userId) setPicked(load<string>(key(userId), ""));
  }, [userId]);
  const current = branches.find((b) => b.id === picked) ?? branches[0];
  const select = (id: string) => {
    if (!userId || !branches.some((b) => b.id === id)) return;
    setPicked(id);
    save(key(userId), id);
  };
  return { id: current?.id ?? "", name: current?.name ?? "", options: branches, select };
}

export type SaleBranch = ReturnType<typeof useSaleBranch>;
