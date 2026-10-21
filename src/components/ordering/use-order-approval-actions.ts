"use client";

import React, { useState, useCallback } from "react";
import { App } from "antd";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";

export function useOrderApprovalActions(
  order: OrderDetail | null,
  setOrder: React.Dispatch<React.SetStateAction<OrderDetail | null>>,
  fetchOrder: () => Promise<void>,
  onTableStatusChanged: () => void,
) {
  const { message } = App.useApp();
  const [approvalLoading, setApprovalLoading] = useState(false);

  const cancelKitchenItem = useCallback(
    async (item: OrderItemDetail, approval: { pinCode?: string; lyDo: string }) => {
      if (!order) return { ok: false, error: "Đơn hàng không tồn tại" };
      setApprovalLoading(true);
      try {
        const res = await fetch(`/api/v1/orders/${order.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            orderItemId: item.id,
            expectedVersion: order.version,
            pinCode: approval.pinCode,
            lyDo: approval.lyDo,
          }),
        });
        const data = await res.json();
        if (data.ok && data.data) {
          setOrder(data.data);
          message.success(`Đã hủy món ${item.menuItemName}`);
          onTableStatusChanged();
          return { ok: true };
        } else {
          message.error(data.error || "Không thể hủy món đã gửi bếp");
          if (res.status === 409) await fetchOrder();
          return { ok: false, error: data.error, status: res.status };
        }
      } catch {
        message.error("Lỗi kết nối khi hủy món");
        return { ok: false, error: "Lỗi kết nối" };
      } finally {
        setApprovalLoading(false);
      }
    },
    [order, fetchOrder, onTableStatusChanged, message, setOrder],
  );

  const applyDiscount = useCallback(
    async (discountInput: { amount?: number; percent?: number; lyDo: string; pinCode?: string }) => {
      if (!order) return { ok: false, error: "Đơn hàng không tồn tại" };
      setApprovalLoading(true);
      try {
        const res = await fetch(`/api/v1/orders/${order.id}/discount`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: order.version,
            ...discountInput,
          }),
        });
        const data = await res.json();
        if (data.ok && data.data) {
          setOrder(data.data);
          message.success("Đã áp dụng giảm giá thành công");
          onTableStatusChanged();
          return { ok: true };
        } else {
          message.error(data.error || "Không thể áp dụng giảm giá");
          if (res.status === 409) await fetchOrder();
          return { ok: false, error: data.error, status: res.status };
        }
      } catch {
        message.error("Lỗi kết nối khi áp dụng giảm giá");
        return { ok: false, error: "Lỗi kết nối" };
      } finally {
        setApprovalLoading(false);
      }
    },
    [order, fetchOrder, onTableStatusChanged, message, setOrder],
  );

  const cancelOrderWithItems = useCallback(
    async (cancelInput: { lyDo: string; pinCode?: string }) => {
      if (!order) return { ok: false, error: "Đơn hàng không tồn tại" };
      setApprovalLoading(true);
      try {
        const res = await fetch(`/api/v1/orders/${order.id}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: order.version,
            ...cancelInput,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          message.success("Đã hủy đơn hàng thành công");
          onTableStatusChanged();
          return { ok: true };
        } else {
          message.error(data.error || "Không thể hủy đơn hàng");
          if (res.status === 409) await fetchOrder();
          return { ok: false, error: data.error, status: res.status };
        }
      } catch {
        message.error("Lỗi kết nối khi hủy đơn hàng");
        return { ok: false, error: "Lỗi kết nối" };
      } finally {
        setApprovalLoading(false);
      }
    },
    [order, fetchOrder, onTableStatusChanged, message],
  );

  return {
    approvalLoading,
    cancelKitchenItem,
    applyDiscount,
    cancelOrderWithItems,
  };
}
