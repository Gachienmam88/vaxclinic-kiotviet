"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Danh mục tên (Danh mục phụ cấp / Danh mục giảm trừ): thêm, xóa; "Xong" trả danh sách mới cho trang thiết lập. */
export function HrSettingsNameListDialog({ title, placeholder, names, onDone, onClose }: {
  title: string; placeholder: string; names: string[]; onDone: (names: string[]) => void; onClose: () => void;
}) {
  const [list, setList] = useState(names);
  const [name, setName] = useState("");
  const add = () => {
    const n = name.trim();
    if (n && !list.some((x) => x.toLowerCase() === n.toLowerCase())) setList([...list, n]);
    setName("");
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input value={name} placeholder={placeholder} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <Button variant="outline" onClick={add} disabled={!name.trim()}>Thêm</Button>
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto text-[13px]">
          {!list.length && <li className="py-4 text-center text-muted-foreground">Chưa có mục nào</li>}
          {list.map((n) => (
            <li key={n} className="flex items-center justify-between rounded-md bg-[#f3f6fa] px-2.5 py-1.5">
              {n}
              <button type="button" aria-label={`Xóa ${n}`} onClick={() => setList(list.filter((x) => x !== n))}>
                <X className="size-3.5 hover:text-destructive" /></button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button onClick={() => { onDone(list); onClose(); }}>Xong</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
