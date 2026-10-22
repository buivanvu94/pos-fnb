"use client";

import React, { useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  Row,
  Col,
  Typography,
  Segmented,
  Tooltip,
  Button,
  Space,
  Spin,
  Card,
  Result,
} from "antd";
import {
  ArrowLeftOutlined,
  DollarOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import { MainLayout } from "@/components/main-layout";
import { PaymentSummary } from "@/components/payment/payment-summary";
import { CashTenderBox } from "@/components/payment/cash-tender-box";
import { VietQrBox } from "@/components/payment/vietqr-box";
import { PaymentResultView } from "@/components/payment/payment-result-view";
import { usePaymentOrder } from "@/components/payment/use-payment-order";

const { Title, Text } = Typography;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PaymentPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderId = Number(resolvedParams.id);
  const router = useRouter();

  const isVietQrConfigured = process.env.NEXT_PUBLIC_VIETQR_ENABLED !== "false";
  const [paymentMethod, setPaymentMethod] = useState<string>("TIEN_MAT");

  const {
    order,
    loading,
    cashGiven,
    setCashGiven,
    submitting,
    printPickupTicket,
    setPrintPickupTicket,
    paymentSuccessData,
    setPaymentSuccessData,
    handleCashPayment,
  } = usePaymentOrder(orderId);

  if (loading) {
    return (
      <MainLayout>
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <Spin size="large" tip="Đang tải hóa đơn..." />
        </div>
      </MainLayout>
    );
  }

  if (!order) {
    return (
      <MainLayout>
        <Card style={{ margin: "40px auto", maxWidth: 500, textAlign: "center" }}>
          <Result
            status="404"
            title="Không tìm thấy đơn hàng"
            subTitle="Đơn hàng không tồn tại hoặc đã bị hủy."
            extra={
              <Button type="primary" onClick={() => router.back()}>
                Quay lại
              </Button>
            }
          />
        </Card>
      </MainLayout>
    );
  }

  // Already paid view
  if (paymentSuccessData || order.status === "DA_THANH_TOAN") {
    const successInfo = paymentSuccessData?.data || order;
    return (
      <MainLayout>
        <PaymentResultView
          orderId={order.id}
          orderCode={successInfo.orderCode || order.orderCode}
          orderType={successInfo.orderType || order.orderType}
          queueNumber={successInfo.queueNumber}
          finalAmount={successInfo.finalAmount || order.finalAmount}
          cashGiven={successInfo.cashGiven || cashGiven}
          cashReturned={successInfo.cashReturned ?? (cashGiven - order.finalAmount)}
          printWarning={paymentSuccessData?.printWarning}
          onBack={() => {
            if (order.orderType === "MANG_VE") {
              router.push("/counter");
            } else {
              router.push("/tables");
            }
          }}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ marginBottom: 16 }}>
        <Space align="center" style={{ marginBottom: 8 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            Quay lại
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            Thanh toán hóa đơn: {order.orderCode}
          </Title>
        </Space>
        <Text type="secondary" style={{ display: "block" }}>
          Chọn phương thức thanh toán và kiểm tra tiền thối lại cho khách.
        </Text>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Segmented
          size="large"
          value={paymentMethod}
          onChange={(val) => setPaymentMethod(val as string)}
          options={[
            {
              label: (
                <Space style={{ padding: "4px 12px" }}>
                  <DollarOutlined />
                  <span>Tiền mặt</span>
                </Space>
              ),
              value: "TIEN_MAT",
            },
            ...(isVietQrConfigured
              ? [
                  {
                    label: (
                      <Space style={{ padding: "4px 12px" }}>
                        <QrcodeOutlined />
                        <span>Chuyển khoản VietQR</span>
                      </Space>
                    ),
                    value: "VIETQR",
                  },
                ]
              : []),
          ]}
        />
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} md={12}>
          <PaymentSummary order={order} />
        </Col>

        <Col xs={24} md={12}>
          {paymentMethod === "TIEN_MAT" && (
            <CashTenderBox
              finalAmount={order.finalAmount}
              cashGiven={cashGiven}
              onCashGivenChange={setCashGiven}
              onSubmit={handleCashPayment}
              loading={submitting}
              isTakeaway={order.orderType === "MANG_VE"}
              printPickupTicket={printPickupTicket}
              onPrintPickupTicketChange={setPrintPickupTicket}
            />
          )}

          {paymentMethod === "VIETQR" && isVietQrConfigured && (
            <VietQrBox
              orderId={order.id}
              finalAmount={order.finalAmount}
              orderCode={order.orderCode}
              expectedVersion={order.version}
              isTakeaway={order.orderType === "MANG_VE"}
              printPickupTicket={printPickupTicket}
              onPrintPickupTicketChange={setPrintPickupTicket}
              onPaymentSuccess={(data) => setPaymentSuccessData(data)}
            />
          )}
        </Col>
      </Row>
    </MainLayout>
  );
}
