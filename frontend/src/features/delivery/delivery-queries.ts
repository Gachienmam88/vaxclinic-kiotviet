"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  DeliveryPartner, PartnerGroup, PartnerLedgerRow, PartnerList, ReconcileRow, SalesChannel, SettlementRow, ShipmentDetail, ShipmentList,
} from "./delivery-types";

export const useShipments = (params: URLSearchParams) =>
  useQuery({ queryKey: ["shipments", params.toString()], queryFn: () => api<ShipmentList>(`/shipments?${params}`), placeholderData: (p) => p });

export const useShipment = (id: string | null) =>
  useQuery({ queryKey: ["shipment", id], queryFn: () => api<ShipmentDetail>(`/shipments/${id}`), enabled: !!id });

export const usePartners = (params: URLSearchParams) =>
  useQuery({ queryKey: ["delivery-partners", params.toString()], queryFn: () => api<PartnerList>(`/delivery-partners?${params}`),
    placeholderData: (p) => p });

/** Đối tác cho ô chọn (tất cả, kể cả ngừng hoạt động để lọc vận đơn cũ). */
export const usePartnerOptions = () =>
  useQuery({ queryKey: ["delivery-partners", "options"], queryFn: () => api<PartnerList>("/delivery-partners?size=200"),
    select: (d) => d.items, staleTime: 60_000 });

/** Nhóm đối tác giao hàng (ô "Nhóm đối tác"). */
export const usePartnerGroups = () =>
  useQuery({ queryKey: ["delivery-partner-groups"], queryFn: () => api<PartnerGroup[]>("/delivery-partners/groups"), staleTime: 60_000 });

export const usePartner = (id: string | null) =>
  useQuery({ queryKey: ["delivery-partner", id], queryFn: () => api<DeliveryPartner>(`/delivery-partners/${id}`), enabled: !!id });

export const usePartnerLedger = (id: string) =>
  useQuery({ queryKey: ["delivery-partner-ledger", id], queryFn: () => api<PartnerLedgerRow[]>(`/delivery-partners/${id}/ledger`) });

export const usePartnerSettlements = (id: string) =>
  useQuery({ queryKey: ["delivery-settlements", id], queryFn: () => api<SettlementRow[]>(`/delivery-partners/${id}/settlements`) });

export const useReconcilable = (partnerId: string, branchId: string) =>
  useQuery({ queryKey: ["delivery-reconcilable", partnerId, branchId], enabled: !!partnerId,
    queryFn: () => api<ReconcileRow[]>(`/delivery-partners/${partnerId}/reconcilable${branchId ? `?branchId=${branchId}` : ""}`) });

export const useSalesChannels = (all = false) =>
  useQuery({ queryKey: ["sales-channels", all], queryFn: () => api<SalesChannel[]>(`/sales-channels${all ? "?all=true" : ""}`), staleTime: 60_000 });

/** Sau mọi thao tác giao hàng: làm mới vận đơn, đối tác, hóa đơn, sổ quỹ, công nợ khách. */
export function refreshDelivery(qc: QueryClient) {
  ["shipments", "shipment", "delivery-partners", "delivery-partner", "delivery-partner-ledger", "delivery-settlements",
    "delivery-reconcilable", "invoices", "invoice", "cashbook", "customers", "customer", "products"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
