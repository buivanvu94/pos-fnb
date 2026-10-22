import React from "react";
import { Card, InputNumber, Space, Button, Typography, Statistic } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { formatVnd } from "@/lib/money";

const { Text } = Typography;

interface CashTenderBoxProps {
  finalAmount: number;
  cashGiven: number;
  onCashGivenChange: (val: number) => void;
  onSubmit: () => void;
  loading: boolean;
}

const COMMON_DENOMINATIONS = [50_000, 100_000, 200_000, 500_000];

export function CashTenderBox({
  finalAmount,
  cashGiven,
  onCashGivenChange,
  onSubmit,
  loading,
}: CashTenderBoxProps) {
  const changeDue = Math.max(0, cashGiven - finalAmount);
  const isShort = cashGiven < finalAmount;

  return (
    <Card title="Thu tiền mặt" style={{ borderRadius: 8, height: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
          Tiền khách đưa (VNĐ):
        </Text>
        <InputNumber
          size="large"
          style={{ width: "100%", fontSize: 24, height: 52 }}
          value={cashGiven}
          min={0}
          max={2_000_000_000}
          step={1_000}
          formatter={(val) => (val ? `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "")}
          parser={(val) => Number((val ?? "").replace(/\./g, "")) || 0}
          onChange={(val) => onCashGivenChange(Number(val) || 0)}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 13 }}>
          Gợi ý mệnh giá nhanh:
        </Text>
        <Space wrap size={[8, 8]}>
          <Button
            type={cashGiven === finalAmount ? "primary" : "default"}
            onClick={() => onCashGivenChange(finalAmount)}
          >
            Đủ tiền ({formatVnd(finalAmount)})
          </Button>
          {COMMON_DENOMINATIONS.map((deno) => (
            <Button key={deno} onClick={() => onCashGivenChange(deno)}>
              {formatVnd(deno)}
            </Button>
          ))}
          {finalAmount > 500_000 && (
            <Button onClick={() => onCashGivenChange(Math.ceil(finalAmount / 500_000) * 500_000)}>
              Làm tròn 500k ({formatVnd(Math.ceil(finalAmount / 500_000) * 500_000)})
            </Button>
          )}
        </Space>
      </div>

      <div
        style={{
          background: isShort ? "#fff1f0" : "#f6ffed",
          border: `1px solid ${isShort ? "#ffa39e" : "#b7eb8f"}`,
          borderRadius: 8,
          padding: "16px 20px",
          marginBottom: 24,
        }}
      >
        <Text style={{ fontSize: 14, color: isShort ? "#cf1322" : "#389e0d" }}>
          {isShort ? "Khách còn thiếu:" : "Tiền thối lại cho khách:"}
        </Text>
        <Statistic
          value={isShort ? finalAmount - cashGiven : changeDue}
          formatter={(val) => formatVnd(Number(val))}
          valueStyle={{
            color: isShort ? "#cf1322" : "#389e0d",
            fontWeight: 700,
            fontSize: 26,
          }}
        />
      </div>

      <Button
        type="primary"
        size="large"
        block
        style={{ height: 50, fontSize: 18, backgroundColor: "#52c41a", borderColor: "#52c41a" }}
        icon={<CheckOutlined />}
        loading={loading}
        disabled={isShort || loading}
        onClick={onSubmit}
      >
        Hoàn tất thanh toán
      </Button>
    </Card>
  );
}
