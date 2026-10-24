"use client";

import { useState } from "react";
import { App } from "antd";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";
import type { MenuItemData } from "@/components/ordering/menu-grid";
import { ERROR_CATALOG } from "@/lib/error-catalog";

export function useCounterOrder() {
  const { message } = App.useApp();

  const [activeOrder, setActiveOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItemData | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const ensureActiveOrder = async (): Promise<OrderDetail | null> => {
    if (activeOrder && activeOrder.status === "DANG_PHUC_VU") {
      return activeOrder;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderType: "MANG_VE" }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setActiveOrder(data.data);
        return data.data;
      } else {
        message.error(data.error || "Không thể tạo đơn mang về");
        return null;
      }
    } catch {
      message.error("Lỗi kết nối khi tạo đơn mang về");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (item: MenuItemData) => {
    const order = await ensureActiveOrder();
    if (!order) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${order.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          menuItemId: item.id,
          quantity: 1,
          expectedVersion: order.version,
        }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setActiveOrder(data.data);
      } else {
        message.error(data.error || "Không thể thêm món vào đơn");
      }
    } catch {
      message.error("Lỗi kết nối khi thêm món");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomized = async (data: { quantity: number; notes: string; toppingIds: number[] }) => {
    if (!customizingItem) return;
    const order = await ensureActiveOrder();
    if (!order) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${order.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          menuItemId: customizingItem.id,
          quantity: data.quantity,
          notes: data.notes || undefined,
          toppingIds: data.toppingIds,
          expectedVersion: order.version,
        }),
      });
      const resData = await res.json();
      if (resData.ok && resData.data) {
        setActiveOrder(resData.data);
        setCustomizerOpen(false);
      } else {
        message.error(resData.error || "Không thể thêm món");
      }
    } catch {
      message.error("Lỗi kết nối khi thêm món tùy chỉnh");
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = async (item: OrderItemDetail, newQty: number) => {
    if (!activeOrder) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${activeOrder.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: newQty <= 0 ? "delete" : "update",
          orderItemId: item.id,
          quantity: newQty,
          expectedVersion: activeOrder.version,
        }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setActiveOrder(data.data);
      } else {
        message.error(data.error || "Không thể thay đổi số lượng");
      }
    } catch {
      message.error("Lỗi kết nối");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (item: OrderItemDetail) => {
    if (!activeOrder) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${activeOrder.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          orderItemId: item.id,
          expectedVersion: activeOrder.version,
        }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setActiveOrder(data.data);
      } else {
        message.error(data.error || "Không thể xóa món");
      }
    } catch {
      message.error("Lỗi kết nối khi xóa món");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    const activeItems = activeOrder?.items?.filter((i) => !i.isCancelled) ?? [];
    if (!activeOrder || activeItems.length === 0 || activeOrder.finalAmount <= 0) {
      message.error(ERROR_CATALOG.ERR_08.message);
      return;
    }
    setPaymentOpen(true);
  };

  // Đơn đã thanh toán: làm mới giỏ cho khách kế tiếp
  const handlePaymentFinished = () => {
    setPaymentOpen(false);
    setActiveOrder(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos:shift-updated"));
    }
  };

  const handleClearCart = async () => {
    if (!activeOrder) return;
    setLoading(true);
    try {
      await fetch(`/api/v1/orders/${activeOrder.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyDo: "Khách hủy order mang về tại quầy",
          expectedVersion: activeOrder.version,
        }),
      });
      setActiveOrder(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos:shift-updated"));
    }
      message.success("Đã làm mới giỏ hàng mang về");
    } catch {
      setActiveOrder(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos:shift-updated"));
    }
    } finally {
      setLoading(false);
    }
  };

  return {
    activeOrder,
    loading,
    customizerOpen,
    setCustomizerOpen,
    customizingItem,
    setCustomizingItem,
    handleSelectItem,
    handleAddCustomized,
    handleQuantityChange,
    handleDeleteItem,
    handleCheckout,
    handleClearCart,
    paymentOpen,
    closePayment: () => setPaymentOpen(false),
    handlePaymentFinished,
  };
}
