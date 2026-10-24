"use client";

import React, { useState } from "react";
import {
  Card,
  Typography,
  Space,
  Button,
  QRCode,
  Statistic,
  Alert,
  Spin,
  Checkbox,
} from "antd";
import {
  ReloadOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { formatVnd } from "@/lib/money";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { useVietQrPayment } from "./use-vietqr-payment";
import { VietQrManualModal } from "./vietqr-manual-modal";

const { Text } = Typography;

interface VietQrBoxProps {
  orderId: number;
  finalAmount: number;
  orderCode: string;
  expectedVersion: number;
  isTakeaway: boolean;
  printPickupTicket: boolean;
  onPrintPickupTicketChange: (val: boolean) => void;
  onPaymentSuccess: (data: any) => void;
}

export function VietQrBox({
  orderId,
  finalAmount,
  orderCode,
  expectedVersion,
  isTakeaway,
  printPickupTicket,
  onPrintPickupTicketChange,
  onPaymentSuccess,
}: VietQrBoxProps) {
  const [manualModalVisible, setManualModalVisible] = useState(false);

  const {
    loading,
    qrContent,
    transferContent,
    deadline,
    isExpired,
    setIsExpired,
    createQr,
  } = useVietQrPayment({
    orderId,
    expectedVersion,
    onPaymentSuccess,
  });

  return (
    <Card title="Thanh toán chuyển khoản VietQR" style={{ height: "100%" }}>
      {isExpired && (
        <Alert
          message={ERROR_CATALOG.ERR_09.message}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={createQr}>
              Tạo lại mã QR
            </Button>
          }
        />
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: "#8c8c8c" }}>Đang tạo mã VietQR...</div>
        </div>
      ) : (
        <Space direction="vertical" style={{ width: "100%", alignItems: "center" }} size={16}>
          <div style={{ textAlign: "center" }}>
            <QRCode
              value={qrContent || "vietqr-placeholder"}
              size={210}
              status={isExpired ? "expired" : "active"}
              onRefresh={createQr}
            />
            {deadline && !isExpired && (
              <div style={{ marginTop: 8 }}>
                <Statistic.Countdown
                  title="Thời gian chờ quét mã (3 phút):"
                  value={deadline}
                  format="m:ss"
                  onFinish={() => setIsExpired(true)}
                  valueStyle={{ fontSize: 20, color: "#fa8c16", fontWeight: "bold" }}
                />
              </div>
            )}
          </div>

          <div style={{ width: "100%", background: "#f5f5f5", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <Text type="secondary">Số tiền cần thanh toán:</Text>
              <Text strong style={{ fontSize: 18, color: "#1677ff" }}>{formatVnd(finalAmount)}</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text type="secondary">Nội dung chuyển khoản:</Text>
              <Text strong copyable={{ text: transferContent }}>{transferContent || orderCode}</Text>
            </div>
          </div>

          {isTakeaway && (
            <div style={{ width: "100%" }}>
              <Checkbox checked={printPickupTicket} onChange={(e) => onPrintPickupTicketChange(e.target.checked)}>
                In phiếu lấy đồ (Pickup Ticket)
              </Checkbox>
            </div>
          )}

          <div style={{ width: "100%", display: "flex", gap: 8, marginTop: 8 }}>
            <Button icon={<ReloadOutlined />} onClick={createQr} disabled={loading} style={{ flex: 1 }}>
              Làm mới mã QR
            </Button>
            <Button
              danger
              icon={<ExclamationCircleOutlined />}
              onClick={() => setManualModalVisible(true)}
              style={{ flex: 1 }}
            >
              Xác nhận thủ công
            </Button>
          </div>
        </Space>
      )}

      <VietQrManualModal
        visible={manualModalVisible}
        orderId={orderId}
        expectedVersion={expectedVersion}
        printPickupTicket={printPickupTicket}
        onClose={() => setManualModalVisible(false)}
        onSuccess={onPaymentSuccess}
      />
    </Card>
  );
}
