"use client";

import React, { useState, useEffect } from "react";
import { Row, Col, Typography, Segmented, Button, Space, Spin, Card, Result } from "antd";
import { ArrowLeftOutlined, DollarOutlined, QrcodeOutlined } from "@ant-design/icons";
import { PaymentSummary } from "./payment-summary";
import { CashTenderBox } from "./cash-tender-box";
import { VietQrBox } from "./vietqr-box";
import { PaymentResultView } from "./payment-result-view";
import { usePaymentOrder } from "./use-payment-order";

const { Title, Text } = Typography;

interface PaymentPanelProps {
  orderId: number;
  /** Hiển thị trong modal: bỏ tiêu đề trang và nút "Quay lại" (modal tự có nút đóng). */
  embedded?: boolean;
  /** Bấm "Quay lại" khi chưa thanh toán (chỉ dùng ở dạng trang). */
  onCancel?: () => void;
  /** Gọi một lần khi đơn đã được thanh toán xong. */
  onPaid?: () => void;
  /** Bấm nút quay về ở màn kết quả; nhận loại đơn để chọn nơi quay về. */
  onBack: (orderType: string) => void;
}

/** Nội dung thanh toán dùng chung cho trang /payment/[id] và modal. */
export function PaymentPanel({ orderId, embedded = false, onCancel, onPaid, onBack }: PaymentPanelProps) {
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

  const isPaid = Boolean(paymentSuccessData) || order?.status === "DA_THANH_TOAN";

  useEffect(() => {
    if (isPaid) onPaid?.();
  }, [isPaid, onPaid]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <Spin size="large" tip="Đang tải hóa đơn..." />
      </div>
    );
  }

  if (!order) {
    return (
      <Card style={{ margin: "40px auto", maxWidth: 500, textAlign: "center" }}>
        <Result
          status="404"
          title="Không tìm thấy đơn hàng"
          subTitle="Đơn hàng không tồn tại hoặc đã bị hủy."
          extra={
            onCancel && (
              <Button type="primary" onClick={onCancel}>
                Quay lại
              </Button>
            )
          }
        />
      </Card>
    );
  }

  if (isPaid) {
    const successInfo = paymentSuccessData?.data || order;
    return (
      <PaymentResultView
        orderId={order.id}
        orderCode={successInfo.orderCode || order.orderCode}
        orderType={successInfo.orderType || order.orderType}
        queueNumber={successInfo.queueNumber}
        finalAmount={successInfo.finalAmount || order.finalAmount}
        cashGiven={successInfo.cashGiven || cashGiven}
        cashReturned={successInfo.cashReturned ?? cashGiven - order.finalAmount}
        printWarning={paymentSuccessData?.printWarning}
        onBack={() => onBack(order.orderType)}
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        {embedded ? (
          <Text type="secondary">
            Hóa đơn <Text strong>{order.orderCode}</Text>: chọn phương thức thanh toán và kiểm tra tiền thối lại cho khách.
          </Text>
        ) : (
          <>
            <Space align="center" style={{ marginBottom: 8 }}>
              <Button icon={<ArrowLeftOutlined />} onClick={onCancel}>
                Quay lại
              </Button>
              <Title level={3} style={{ margin: 0 }}>
                Thanh toán hóa đơn: {order.orderCode}
              </Title>
            </Space>
            <Text type="secondary" style={{ display: "block" }}>
              Chọn phương thức thanh toán và kiểm tra tiền thối lại cho khách.
            </Text>
          </>
        )}
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
    </div>
  );
}
