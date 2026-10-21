import React, { useState, useEffect, useCallback } from "react";
import { Button, Row, Col, Typography, Space, App, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { MenuGrid, MenuItemData, CategoryData } from "./menu-grid";
import { OrderCart } from "./order-cart";
import { ItemCustomizerDrawer, ToppingOption } from "./item-customizer-drawer";
import { TransferMergeModal } from "./transfer-merge-modal";
import { useOrderActions } from "./use-order-actions";
import type { TableWithOrderInfo } from "@/server/tables/table-service";
import type { OrderDetail } from "@/server/orders/order-service";

const { Title, Text } = Typography;

interface OrderingViewProps {
  table: TableWithOrderInfo;
  orderId: number;
  allTables: TableWithOrderInfo[];
  onBackToTables: () => void;
  onTableStatusChanged: () => void;
}

export function OrderingView({
  table,
  orderId,
  allTables,
  onBackToTables,
  onTableStatusChanged,
}: OrderingViewProps) {
  const { message } = App.useApp();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [transferLoading, setTransferLoading] = useState(false);

  // Menu data
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [toppings, setToppings] = useState<ToppingOption[]>([]);

  // Drawer & Modal states
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItemData | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // Fetch full order details
  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`);
      const data = await res.json();
      if (data.ok && data.data) {
        setOrder(data.data);
      } else {
        message.error(data.error || "Không thể tải chi tiết đơn hàng");
      }
    } catch {
      message.error("Lỗi kết nối khi tải chi tiết đơn hàng");
    } finally {
      setLoadingOrder(false);
    }
  }, [orderId, message]);

  // Hook for actions
  const {
    actionLoading,
    sendingKitchen,
    quickAdd,
    addCustomized,
    changeQuantity,
    deleteItem,
    sendKitchen,
    cancelEmptyOrder,
  } = useOrderActions(order, setOrder, fetchOrder, onTableStatusChanged);

  // Fetch menu, categories, toppings
  useEffect(() => {
    fetchOrder();

    fetch("/api/v1/menu/items")
      .then((r) => r.json())
      .then((d) => d.ok && setMenuItems(d.data || []))
      .catch(() => {});

    fetch("/api/v1/menu/categories")
      .then((r) => r.json())
      .then((d) => d.ok && setCategories(d.data || []))
      .catch(() => {});

    fetch("/api/v1/menu/toppings")
      .then((r) => r.json())
      .then((d) => d.ok && setToppings(d.data || []))
      .catch(() => {});
  }, [fetchOrder]);

  // Transfer / Merge confirm
  const handleTransferMergeConfirm = async (transferData: {
    banNguonId: number;
    banDichId: number;
    loai: "CHUYEN" | "GOP";
  }) => {
    setTransferLoading(true);
    try {
      const res = await fetch("/api/v1/tables/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferData),
      });
      const data = await res.json();

      if (data.ok) {
        message.success(
          transferData.loai === "CHUYEN"
            ? "Chuyển bàn thành công"
            : "Gộp bàn thành công",
        );
        setTransferModalOpen(false);
        onTableStatusChanged();
        onBackToTables();
      } else {
        message.error(data.error || "Không thể thực hiện chuyển/gộp bàn");
      }
    } catch {
      message.error("Lỗi kết nối khi chuyển/gộp bàn");
    } finally {
      setTransferLoading(false);
    }
  };

  if (loadingOrder) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBackToTables}>
            Sơ đồ bàn
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {table.name} ({table.areaName || "Khu vực"})
          </Title>
        </Space>
        <Text type="secondary">
          Mã đơn: {order?.orderCode || "—"} (v{order?.version || 1})
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15} xl={16}>
          <MenuGrid
            items={menuItems}
            categories={categories}
            loading={actionLoading}
            onQuickAddItem={quickAdd}
            onCustomizeItem={(it) => {
              setCustomizingItem(it);
              setCustomizerOpen(true);
            }}
          />
        </Col>

        <Col xs={24} lg={9} xl={8}>
          <OrderCart
            order={order}
            tableName={table.name}
            loading={actionLoading}
            sendingKitchen={sendingKitchen}
            onQuantityChange={changeQuantity}
            onDeleteItem={deleteItem}
            onSendKitchen={sendKitchen}
            onOpenTransferModal={() => setTransferModalOpen(true)}
            onCancelOrder={async () => {
              const ok = await cancelEmptyOrder();
              if (ok) onBackToTables();
            }}
          />
        </Col>
      </Row>

      <ItemCustomizerDrawer
        open={customizerOpen}
        menuItem={customizingItem}
        availableToppings={toppings}
        loading={actionLoading}
        onClose={() => setCustomizerOpen(false)}
        onConfirm={async (data) => {
          const ok = await addCustomized(data);
          if (ok) setCustomizerOpen(false);
        }}
      />

      <TransferMergeModal
        open={transferModalOpen}
        sourceTable={table}
        currentOrder={order}
        allTables={allTables}
        loading={transferLoading}
        onClose={() => setTransferModalOpen(false)}
        onConfirm={handleTransferMergeConfirm}
      />
    </div>
  );
}
