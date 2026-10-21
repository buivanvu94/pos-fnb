import React, { useState, useCallback } from "react";
import { App, Button } from "antd";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";
import type { MenuItemData } from "./menu-grid";

export function useOrderActions(
  order: OrderDetail | null,
  setOrder: React.Dispatch<React.SetStateAction<OrderDetail | null>>,
  fetchOrder: () => Promise<void>,
  onTableStatusChanged: () => void,
) {
  const { message, notification } = App.useApp();
  const [actionLoading, setActionLoading] = useState(false);
  const [sendingKitchen, setSendingKitchen] = useState(false);

  const postItems = useCallback(
    async (payload: any) => {
      const res = await fetch(`/api/v1/orders/${order!.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: order!.version, ...payload }),
      });
      return { status: res.status, data: await res.json() };
    },
    [order],
  );

  const quickAdd = useCallback(
    async (item: MenuItemData) => {
      if (!order) return;
      setActionLoading(true);
      try {
        const { status, data } = await postItems({ menuItemId: item.id, quantity: 1 });
        if (data.ok && data.data) {
          setOrder(data.data);
          message.success(`Đã thêm ${item.name}`);
          onTableStatusChanged();
        } else {
          message.error(data.error || "Không thể thêm món");
          if (status === 409) await fetchOrder();
        }
      } catch {
        message.error("Lỗi kết nối khi thêm món vào đơn");
      } finally {
        setActionLoading(false);
      }
    },
    [order, postItems, setOrder, fetchOrder, onTableStatusChanged, message],
  );

  const addCustomized = useCallback(
    async (customData: { menuItemId: number; quantity: number; notes: string; toppingIds: number[] }) => {
      if (!order) return false;
      setActionLoading(true);
      try {
        const { status, data } = await postItems({
          menuItemId: customData.menuItemId,
          quantity: customData.quantity,
          notes: customData.notes,
          toppingIds: customData.toppingIds,
        });
        if (data.ok && data.data) {
          setOrder(data.data);
          message.success("Đã thêm món với tùy chọn");
          onTableStatusChanged();
          return true;
        } else {
          message.error(data.error || "Không thể thêm món");
          if (status === 409) await fetchOrder();
          return false;
        }
      } catch {
        message.error("Lỗi khi thêm món vào đơn");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [order, postItems, setOrder, fetchOrder, onTableStatusChanged, message],
  );

  const changeQuantity = useCallback(
    async (item: OrderItemDetail, newQty: number) => {
      if (!order) return;
      setActionLoading(true);
      try {
        const { status, data } = await postItems({
          action: "update",
          orderItemId: item.id,
          menuItemId: item.menuItemId,
          quantity: newQty,
        });
        if (data.ok && data.data) {
          setOrder(data.data);
          onTableStatusChanged();
        } else {
          message.error(data.error || "Không thể cập nhật số lượng");
          if (status === 409) await fetchOrder();
        }
      } catch {
        message.error("Lỗi kết nối khi cập nhật số lượng");
      } finally {
        setActionLoading(false);
      }
    },
    [order, postItems, setOrder, fetchOrder, onTableStatusChanged, message],
  );

  const deleteItem = useCallback(
    async (item: OrderItemDetail) => {
      if (!order) return;
      setActionLoading(true);
      try {
        const { status, data } = await postItems({ action: "delete", orderItemId: item.id });
        if (data.ok && data.data) {
          setOrder(data.data);
          message.success(`Đã xóa ${item.menuItemName}`);
          onTableStatusChanged();
        } else {
          message.error(data.error || "Không thể xóa món");
          if (status === 409) await fetchOrder();
        }
      } catch {
        message.error("Lỗi kết nối khi xóa món");
      } finally {
        setActionLoading(false);
      }
    },
    [order, postItems, setOrder, fetchOrder, onTableStatusChanged, message],
  );

  const sendKitchen = useCallback(async () => {
    if (!order) return;
    setSendingKitchen(true);
    try {
      const res = await fetch(`/api/v1/orders/${order.id}/send-kitchen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: order.version }),
      });
      const data = await res.json();
      if (data.ok) {
        const warning = data.printWarning || data.data?.printWarning;
        if (warning) {
          const key = `print-warning-${Date.now()}`;
          notification.warning({
            key,
            message: "Cảnh báo máy in",
            description: warning.message,
            duration: 0,
            btn: React.createElement(
              Button,
              {
                type: "primary",
                size: "small",
                onClick: async () => {
                  try {
                    const jobs = warning.failedJobs || [];
                    for (const job of jobs) {
                      await fetch(`/api/v1/print-jobs/${job.id}/retry`, { method: "POST" });
                    }
                    notification.destroy(key);
                    message.success("Đã gửi yêu cầu thử in lại");
                  } catch {
                    message.error("Không thể thử in lại lúc này");
                  }
                },
              },
              "Thử in lại",
            ),
          });
        } else {
          message.success("Đã gửi thực đơn xuống Bếp/Bar thành công");
        }
        await fetchOrder();
        onTableStatusChanged();
      } else {
        message.error(data.error || "Không thể gửi bếp");
        if (res.status === 409) await fetchOrder();
      }
    } catch {
      message.error("Lỗi kết nối khi gửi bếp");
    } finally {
      setSendingKitchen(false);
    }
  }, [order, fetchOrder, onTableStatusChanged, message, notification]);

  const cancelEmptyOrder = useCallback(async () => {
    if (!order) return false;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${order.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: order.version }),
      });
      const data = await res.json();
      if (data.ok) {
        message.success("Đã hủy đơn hàng thành công");
        onTableStatusChanged();
        return true;
      } else {
        message.error(data.error || "Không thể hủy đơn hàng");
        if (res.status === 409) await fetchOrder();
        return false;
      }
    } catch {
      message.error("Lỗi kết nối khi hủy đơn hàng");
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [order, fetchOrder, onTableStatusChanged, message]);

  return {
    actionLoading,
    sendingKitchen,
    quickAdd,
    addCustomized,
    changeQuantity,
    deleteItem,
    sendKitchen,
    cancelEmptyOrder,
  };
}
