import { useState, useCallback } from "react";
import { App } from "antd";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";
import type { MenuItemData } from "./menu-grid";

export function useOrderActions(
  order: OrderDetail | null,
  setOrder: React.Dispatch<React.SetStateAction<OrderDetail | null>>,
  fetchOrder: () => Promise<void>,
  onTableStatusChanged: () => void,
) {
  const { message } = App.useApp();
  const [actionLoading, setActionLoading] = useState(false);
  const [sendingKitchen, setSendingKitchen] = useState(false);

  const quickAdd = useCallback(
    async (item: MenuItemData) => {
      if (!order) return;
      setActionLoading(true);

      try {
        const res = await fetch(`/api/v1/orders/${order.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: order.version,
            menuItemId: item.id,
            quantity: 1,
          }),
        });
        const data = await res.json();

        if (data.ok && data.data) {
          setOrder(data.data);
          message.success(`Đã thêm ${item.name}`);
          onTableStatusChanged();
        } else {
          message.error(data.error || "Không thể thêm món");
          if (res.status === 409) fetchOrder();
        }
      } catch {
        message.error("Lỗi kết nối khi thêm món vào đơn");
      } finally {
        setActionLoading(false);
      }
    },
    [order, setOrder, fetchOrder, onTableStatusChanged, message],
  );

  const addCustomized = useCallback(
    async (customData: {
      menuItemId: number;
      quantity: number;
      notes: string;
      toppingIds: number[];
    }) => {
      if (!order) return;
      setActionLoading(true);

      try {
        const res = await fetch(`/api/v1/orders/${order.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: order.version,
            menuItemId: customData.menuItemId,
            quantity: customData.quantity,
            notes: customData.notes,
            toppingIds: customData.toppingIds,
          }),
        });
        const data = await res.json();

        if (data.ok && data.data) {
          setOrder(data.data);
          message.success("Đã thêm món với tùy chọn");
          onTableStatusChanged();
          return true;
        } else {
          message.error(data.error || "Không thể thêm món");
          if (res.status === 409) fetchOrder();
          return false;
        }
      } catch {
        message.error("Lỗi khi thêm món vào đơn");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [order, setOrder, fetchOrder, onTableStatusChanged, message],
  );

  const changeQuantity = useCallback(
    async (item: OrderItemDetail, newQty: number) => {
      if (!order) return;
      setActionLoading(true);

      try {
        const res = await fetch(`/api/v1/orders/${order.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: order.version,
            action: "update",
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            quantity: newQty,
          }),
        });
        const data = await res.json();

        if (data.ok && data.data) {
          setOrder(data.data);
          onTableStatusChanged();
        } else {
          message.error(data.error || "Không thể cập nhật số lượng");
          if (res.status === 409) fetchOrder();
        }
      } catch {
        message.error("Lỗi kết nối khi cập nhật số lượng");
      } finally {
        setActionLoading(false);
      }
    },
    [order, setOrder, fetchOrder, onTableStatusChanged, message],
  );

  const deleteItem = useCallback(
    async (item: OrderItemDetail) => {
      if (!order) return;
      setActionLoading(true);

      try {
        const res = await fetch(`/api/v1/orders/${order.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: order.version,
            action: "delete",
            orderItemId: item.id,
          }),
        });
        const data = await res.json();

        if (data.ok && data.data) {
          setOrder(data.data);
          message.success(`Đã xóa ${item.menuItemName}`);
          onTableStatusChanged();
        } else {
          message.error(data.error || "Không thể xóa món");
          if (res.status === 409) fetchOrder();
        }
      } catch {
        message.error("Lỗi kết nối khi xóa món");
      } finally {
        setActionLoading(false);
      }
    },
    [order, setOrder, fetchOrder, onTableStatusChanged, message],
  );

  const sendKitchen = useCallback(async () => {
    if (!order) return;
    setSendingKitchen(true);

    try {
      const res = await fetch(`/api/v1/orders/${order.id}/send-kitchen`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.ok) {
        message.success("Đã gửi thực đơn xuống Bếp/Bar thành công");
        await fetchOrder();
        onTableStatusChanged();
      } else {
        message.error(data.error || "Không thể gửi bếp");
      }
    } catch {
      message.error("Lỗi kết nối khi gửi bếp");
    } finally {
      setSendingKitchen(false);
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
  };
}
