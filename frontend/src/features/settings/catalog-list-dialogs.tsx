"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { flattenCategoryTree, useCategories, usePositions } from "@/features/products/product-queries";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";

/** Quản lý nhóm hàng (cây cha – con): thêm, đổi tên, xóa nhóm chưa dùng. */
export function CategoryManagerDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; parentId: string | null } | null>(null);
  const done = (msg: string) => { toast.success(msg); qc.invalidateQueries({ queryKey: ["categories"] }); };
  const add = useMutation({
    mutationFn: () => api("/categories", { method: "POST", body: { name, parentId: parentId || null } }),
    onSuccess: () => { done(t("catalog.categoryAdded")); setName(""); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rename = useMutation({
    mutationFn: (c: { id: string; name: string; parentId: string | null }) => api(`/categories/${c.id}`, { method: "PUT", body: c }),
    onSuccess: () => { done(t("catalog.categoryRenamed")); setEditing(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => done(t("catalog.categoryDeleted")),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const tree = flattenCategoryTree(categories);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{t("catalog.categoriesTitle")}</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input placeholder={t("catalog.newCategory")} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="w-44 shrink-0">
            <NativeSelect value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">{t("catalog.parentCategory")}</option>
              {tree.map((c) => <option key={c.id} value={c.id}>{"  ".repeat(c.depth)}{c.name}</option>)}
            </NativeSelect>
          </div>
          <Button disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}><Plus className="size-4" /> {tc("actions.add")}</Button>
        </div>
        <div className="divide-y rounded-md border text-sm">
          {!tree.length && <p className="p-3 text-muted-foreground">{t("catalog.noCategories")}</p>}
          {tree.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-1.5" style={{ paddingLeft: 12 + c.depth * 20 }}>
              {editing?.id === c.id ? (
                <>
                  <Input className="h-8" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  <Button size="icon-sm" disabled={!editing.name.trim()} onClick={() => rename.mutate(editing)}><Check className="size-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1">{c.name}</span>
                  <Button size="icon-sm" variant="ghost" title={tc("actions.edit")} onClick={() => setEditing({ id: c.id, name: c.name, parentId: c.parentId })}><Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" className="text-destructive"
                    onClick={() => confirm(t("catalog.confirmDeleteCategory", { name: c.name })) && remove.mutate(c.id)}><Trash2 className="size-4" /></Button>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Vị trí lưu trữ (tủ, kệ, ngăn tủ lạnh...): xem danh sách và thêm mới. */
export function PositionManagerDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: positions = [] } = usePositions();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => api("/positions", { method: "POST", body: { name } }),
    onSuccess: () => { toast.success(t("catalog.positionAdded")); setName(""); qc.invalidateQueries({ queryKey: ["positions"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("catalog.positionsTitle")}</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input placeholder={t("catalog.positionPlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}><Plus className="size-4" /> {tc("actions.add")}</Button>
        </div>
        <div className="divide-y rounded-md border text-sm">
          {!positions.length && <p className="p-3 text-muted-foreground">{t("catalog.noPositions")}</p>}
          {positions.map((p) => <p key={p.id} className="px-3 py-2">{p.name}</p>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
