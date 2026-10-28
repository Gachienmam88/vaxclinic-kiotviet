"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Order, OrderList } from "./order-types";

export const useOrders = (params: URLSearchParams) =>
  useQuery({
    queryKey: ["orders", params.toString()],
    queryFn: () => api<OrderList>(`/orders?${params}`),
    placeholderData: (prev) => prev,
  });

export const useOrder = (id: string | null) =>
  useQuery({ queryKey: ["order", id], queryFn: () => api<Order>(`/orders/${id}`), enabled: !!id });
