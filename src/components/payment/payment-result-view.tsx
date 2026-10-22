import React, { useState } from "react";
import { Result, Button, Typography, Space, Alert, App, Tag } from "antd";
import { PrinterOutlined, HomeOutlined, ShoppingOutlined } from "@ant-design/icons";
import { formatVnd } from "@/lib/money";

const { Text, Title } = Typography;

interface PaymentResultViewProps {
  orderCode: string;
  orderType: string;
  queueNumber?: number | null;
  finalAmount: number;
  cashGiven: number;
  cashReturned: number;
  orderId: number;
  printWarning?: { message: string };
  onBack: () => void;
}

export function PaymentResultView({
  orderCode,
  orderType,
  queueNumber,
  finalAmount,
  cashGiven,
  cashReturned,
  orderId,
  printWarning,
  onBack,
}: PaymentResultViewProps) {
  const { message } = App.useApp();
  const [reprinting, setReprinting] = useState(false);
  const isTakeaway = orderType === "MANG_VE";

  const handleReprint = async () => {
    setReprinting(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/reprint`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        message.success("Đã gửi lệnh in lại hóa đơn");
        if (data.printWarning) {
          message.warning(data.printWarning.message);
        }
      } else {
        message.error(data.error || "Không thể in lại hóa đơn");
      }
    } catch {
      message.error("Lỗi kết nối khi gửi lệnh in lại");
    } finally {
      setReprinting(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 0" }}>
      {printWarning && (
        <Alert
          message={printWarning.message}
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
          action={
            <Button size="small" type="primary" ghost loading={reprinting} onClick={handleReprint}>
              Thử in lại
            </Button>
          }
        />
      )}

      <Result
        status="success"
        title="Thanh toán thành công!"
        subTitle={`Hóa đơn ${orderCode} đã được hoàn tất và ghi nhận vào ca làm việc.`}
        extra={[
          <Button
            key="reprint"
            size="large"
            icon={<PrinterOutlined />}
            loading={reprinting}
            onClick={handleReprint}
          >
            In lại hóa đơn
          </Button>,
          <Button
            key="back"
            type="primary"
            size="large"
            icon={isTakeaway ? <ShoppingOutlined /> : <HomeOutlined />}
            onClick={onBack}
          >
            {isTakeaway ? "Tiếp tục bán tại quầy" : "Quay về sơ đồ bàn"}
          </Button>,
        ]}
      >
        <div
          style={{
            background: "#fafafa",
            borderRadius: 8,
            padding: 20,
            border: "1px solid #f0f0f0",
          }}
        >
          {isTakeaway && queueNumber !== null && queueNumber !== undefined && (
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <Text type="secondary" style={{ display: "block", fontSize: 14 }}>
                SỐ THỨ TỰ NHẬN ĐỒ:
              </Text>
              <Title level={1} style={{ margin: 0, color: "#1677ff", fontSize: 48 }}>
                #{queueNumber}
              </Title>
              <Tag color="cyan">Mang về (Takeaway)</Tag>
            </div>
          )}

          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text type="secondary">Khách cần trả:</Text>
              <Text strong>{formatVnd(finalAmount)}</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text type="secondary">Tiền khách đưa:</Text>
              <Text>{formatVnd(cashGiven)}</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text strong style={{ color: "#389e0d" }}>Tiền thối lại:</Text>
              <Text strong style={{ color: "#389e0d", fontSize: 18 }}>
                {formatVnd(cashReturned)}
              </Text>
            </div>
          </Space>
        </div>
      </Result>
    </div>
  );
}
