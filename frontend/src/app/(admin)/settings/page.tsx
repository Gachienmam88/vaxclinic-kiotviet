import { redirect } from "next/navigation";

/** Bánh răng → Thiết lập: mở mục đầu tiên. */
export default function SettingsIndex() {
  redirect("/settings/products");
}
