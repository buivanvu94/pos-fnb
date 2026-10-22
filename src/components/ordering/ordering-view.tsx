"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button, Row, Col, Typography, Space, App, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { MenuGrid, MenuItemData, CategoryData } from "./menu-grid";
import { OrderCart } from "./order-cart";
import { ItemCustomizerDrawer, ToppingOption } from "./item-customizer-drawer";
import { TransferMergeModal } from "./transfer-merge-modal";
import { useOrderActions } from "./use-order-actions";
import { useOrderApprovalActions } from "./use-order-approval-actions";
import { PaymentModal } from "@/components/payment/payment-modal";
import { ManagerApprovalModal, DiscountModal, useManagerApproval } from "@/components/approval";
import type { TableWithOrderInfo } from "@/server/tables/table-service";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";

const { Title, Text } = Typography;

export interface OrderingViewProps {
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
  const [provisionalLoading, setProvisionalLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>("PHUC_VU");
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Menu data
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [toppings, setToppings] = useState<ToppingOption[]>([]);

  // Drawers & Modals
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItemData | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLockoutUntil, setDiscountLockoutUntil] = useState<number | null>(null);

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

  const {
    approvalLoading,
    cancelKitchenItem,
    applyDiscount,
    cancelOrderWithItems,
  } = useOrderApprovalActions(order, setOrder, fetchOrder, onTableStatusChanged);

  const { modalState, requestApproval, handleConfirm, handleCancel } = useManagerApproval();

  useEffect(() => {
    fetchOrder();

    fetch("/api/v1/auth/me")
      .then((r) => r.json())
      .then((d) => d.ok && d.user && setUserRole(d.user.role))
      .catch(() => {});

    fetch("/api/v1/menu/items").then((r) => r.json()).then((d) => d.ok && setMenuItems(d.data || [])).catch(() => {});
    fetch("/api/v1/menu/categories").then((r) => r.json()).then((d) => d.ok && setCategories(d.data || [])).catch(() => {});
    fetch("/api/v1/menu/toppings").then((r) => r.json()).then((d) => d.ok && setToppings(d.data || [])).catch(() => {});
  }, [fetchOrder]);

  const handleCancelKitchenItemClick = (item: OrderItemDetail) => {
    requestApproval(
      {
        title: "Hủy món đã gửi bếp",
        actionDescription: `Món: ${item.menuItemName} (Số lượng: ${item.quantity})`,
        isPinRequired: userRole !== "QUAN_LY",
      },
      async (approval) => {
        return await cancelKitchenItem(item, approval);
      },
    );
  };

  const handleCancelOrderWithItemsClick = () => {
    requestApproval(
      {
        title: "Hủy đơn hàng",
        actionDescription: `Mã đơn: ${order?.orderCode}`,
        isPinRequired: userRole !== "QUAN_LY",
      },
      async (approval) => {
        const res = await cancelOrderWithItems(approval);
        if (res.ok) {
          onBackToTables();
        }
        return res;
      },
    );
  };

  const handleConfirmDiscount = async (data: { amount?: number; percent?: number; pinCode?: string; lyDo: string }) => {
    setDiscountError(null);
    const res = await applyDiscount(data);
    if (res.ok) {
      setDiscountModalOpen(false);
      setDiscountLockoutUntil(null);
    } else {
      setDiscountError(res.error || "Không thể áp dụng giảm giá");
      if (res.status === 429) {
        setDiscountLockoutUntil(Date.now() + 5 * 60 * 1000);
      }
    }
  };

  if (loadingOrder) {
    return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  }

  const handlePrintProvisional = async () => {
    if (!order) return;
    setProvisionalLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${order.id}/provisional-print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: order.version }),
      });
      const d = await res.json();
      if (d.ok) {
        message.success("Đã in phiếu tạm tính cho khách");
        if (d.printWarning) {
          message.warning(d.printWarning.message);
        }
        fetchOrder();
        onTableStatusChanged();
      } else {
        message.error(d.error || "Lỗi khi in tạm tính");
      }
    } catch {
      message.error("Lỗi kết nối khi gửi lệnh in tạm tính");
    } finally {
      setProvisionalLoading(false);
    }
  };

  const handleNavigatePayment = () => {
    if (!order) return;
    setPaymentOpen(true);
  };

  // Đơn đã thanh toán: bàn được giải phóng, quay về sơ đồ bàn
  const handlePaymentFinished = () => {
    setPaymentOpen(false);
    onTableStatusChanged();
    onBackToTables();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBackToTables}>Sơ đồ bàn</Button>
          <Title level={4} style={{ margin: 0 }}>{table.name} ({table.areaName || "Khu vực"})</Title>
        </Space>
        <Text type="secondary">Mã đơn: {order?.orderCode || "—"} (v{order?.version || 1})</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15} xl={16}>
          <MenuGrid
            items={menuItems}
            categories={categories}
            loading={actionLoading}
            onQuickAddItem={quickAdd}
            onCustomizeItem={(it) => { setCustomizingItem(it); setCustomizerOpen(true); }}
          />
        </Col>

        <Col xs={24} lg={9} xl={8}>
          <OrderCart
            order={order}
            tableName={table.name}
            loading={actionLoading || approvalLoading}
            sendingKitchen={sendingKitchen}
            provisionalLoading={provisionalLoading}
            userRole={userRole}
            onQuantityChange={changeQuantity}
            onDeleteItem={deleteItem}
            onCancelKitchenItem={handleCancelKitchenItemClick}
            onOpenDiscountModal={() => { setDiscountError(null); setDiscountModalOpen(true); }}
            onSendKitchen={sendKitchen}
            onOpenTransferModal={() => setTransferModalOpen(true)}
            onCancelOrder={async () => {
              const ok = await cancelEmptyOrder();
              if (ok) onBackToTables();
            }}
            onCancelOrderWithItems={handleCancelOrderWithItemsClick}
            onPrintProvisional={handlePrintProvisional}
            onNavigatePayment={handleNavigatePayment}
          />
        </Col>
      </Row>

      <PaymentModal
        orderId={order?.id ?? null}
        open={paymentOpen}
        onClose={() => {
          setPaymentOpen(false);
          fetchOrder();
        }}
        onFinished={handlePaymentFinished}
      />

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
        onConfirm={async (data) => {
          setTransferLoading(true);
          try {
            const res = await fetch("/api/v1/tables/transfer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            const d = await res.json();
            if (d.ok) {
              message.success(data.loai === "CHUYEN" ? "Chuyển bàn thành công" : "Gộp bàn thành công");
              setTransferModalOpen(false);
              onTableStatusChanged();
              onBackToTables();
            } else {
              message.error(d.error || "Không thể chuyển/gộp bàn");
            }
          } finally {
            setTransferLoading(false);
          }
        }}
      />

      <ManagerApprovalModal
        open={modalState.open}
        title={modalState.title}
        actionDescription={modalState.actionDescription}
        isPinRequired={modalState.isPinRequired}
        errorMessage={modalState.errorMessage}
        lockoutUntil={modalState.lockoutUntil}
        loading={approvalLoading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <DiscountModal
        open={discountModalOpen}
        totalAmount={order?.totalAmount ?? 0}
        isPinRequired={userRole !== "QUAN_LY"}
        errorMessage={discountError}
        lockoutUntil={discountLockoutUntil}
        loading={approvalLoading}
        onConfirm={handleConfirmDiscount}
        onCancel={() => {
          setDiscountModalOpen(false);
          setDiscountError(null);
        }}
      />
    </div>
  );
}
