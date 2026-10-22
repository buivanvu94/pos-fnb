"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Row, Col, Typography, Button, Space, Result } from "antd";
import { HistoryOutlined } from "@ant-design/icons";
import { MainLayout } from "@/components/main-layout";
import { MenuGrid } from "@/components/ordering/menu-grid";
import { ItemCustomizerDrawer } from "@/components/ordering/item-customizer-drawer";
import { CounterCart } from "@/components/counter/counter-cart";
import { ShiftInvoicesDrawer } from "@/components/counter/shift-invoices-drawer";
import { useCounterMenu } from "@/components/counter/use-counter-menu";
import { PaymentModal } from "@/components/payment/payment-modal";
import { useCounterOrder } from "@/components/counter/use-counter-order";

const { Title, Text } = Typography;

export default function CounterPage() {
  const router = useRouter();
  const [invoicesDrawerOpen, setInvoicesDrawerOpen] = useState(false);

  const { currentUser, menuItems, categories, toppings } = useCounterMenu();
  const {
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
    closePayment,
    handlePaymentFinished,
  } = useCounterOrder();

  if (currentUser && currentUser.role === "PHUC_VU") {
    return (
      <MainLayout>
        <Result
          status="403"
          title="Quyền truy cập bị từ chối"
          subTitle="Màn hình bán hàng tại quầy / mang về chỉ dành cho Quản lý và Thu ngân."
          extra={<Button type="primary" onClick={() => router.push("/tables")}>Về sơ đồ bàn</Button>}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Bán tại quầy / Mang về (Takeaway)</Title>
          <Text type="secondary">Chọn món nhanh, in số thứ tự và thu tiền tại quầy</Text>
        </div>
        <Space>
          <Button icon={<HistoryOutlined />} onClick={() => setInvoicesDrawerOpen(true)}>
            Hóa đơn trong ca
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ minHeight: "calc(100vh - 200px)" }}>
        <Col xs={24} lg={15} xl={16}>
          <MenuGrid
            categories={categories}
            items={menuItems}
            onQuickAddItem={handleSelectItem}
            onCustomizeItem={(item) => {
              setCustomizingItem(item);
              setCustomizerOpen(true);
            }}
          />
        </Col>

        <Col xs={24} lg={9} xl={8}>
          <CounterCart
            order={activeOrder}
            loading={loading}
            onQuantityChange={handleQuantityChange}
            onDeleteItem={handleDeleteItem}
            onCheckout={handleCheckout}
            onClearCart={handleClearCart}
          />
        </Col>
      </Row>

      <PaymentModal
        orderId={activeOrder?.id ?? null}
        open={paymentOpen}
        onClose={closePayment}
        onFinished={handlePaymentFinished}
      />

      <ItemCustomizerDrawer
        open={customizerOpen}
        menuItem={customizingItem}
        availableToppings={toppings}
        loading={loading}
        onClose={() => setCustomizerOpen(false)}
        onConfirm={handleAddCustomized}
      />

      <ShiftInvoicesDrawer
        open={invoicesDrawerOpen}
        onClose={() => setInvoicesDrawerOpen(false)}
        userRole={currentUser?.role}
      />
    </MainLayout>
  );
}
