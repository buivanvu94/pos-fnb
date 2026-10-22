"use client";

import React from "react";
import { Form, InputNumber, Input, Tag, Alert, Typography, Space } from "antd";
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CalculatorOutlined,
} from "@ant-design/icons";
import { formatVndNumber, parseVnd } from "@/lib/money";

const { Text } = Typography;
const MAX_MONEY = 2_000_000_000;

interface CloseShiftCashFormProps {
  expectedCash: number;
  actualCash: number | null;
  onActualCashChange: (val: number | null) => void;
  explanation: string;
  onExplanationChange: (val: string) => void;
  isReadOnly: boolean;
}

export function CloseShiftCashForm({
  expectedCash,
  actualCash,
  onActualCashChange,
  explanation,
  onExplanationChange,
  isReadOnly,
}: CloseShiftCashFormProps) {
  const discrepancy = actualCash !== null ? actualCash - expectedCash : 0;
  const isMatch = actualCash !== null && discrepancy === 0;
  const isDifference = actualCash !== null && discrepancy !== 0;

  return (
    <div style={{ marginBottom: 20 }}>
      <Form layout="vertical">
        <Form.Item
          label={
            <Space>
              <CalculatorOutlined style={{ color: "#1677ff" }} />
              <Text strong style={{ fontSize: 15 }}>
                Tiền mặt thực đếm trong két (VND)
              </Text>
            </Space>
          }
          required
        >
          <InputNumber<number>
            style={{ width: "100%", fontSize: 18 }}
            size="large"
            placeholder="Nhập số tiền thực tế trong két..."
            value={actualCash ?? undefined}
            onChange={(val) => onActualCashChange(val ?? null)}
            disabled={isReadOnly}
            formatter={(value) =>
              value !== undefined ? formatVndNumber(Number(value)) : ""
            }
            parser={(displayValue) =>
              displayValue ? parseVnd(displayValue) : 0
            }
            addonAfter="₫"
            min={0}
            max={MAX_MONEY}
          />
        </Form.Item>

        {/* Discrepancy Display: Green Tag for 0đ, Red Tag for difference */}
        {actualCash !== null && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ marginRight: 8 }}>
              Độ lệch két:
            </Text>
            {isMatch ? (
              <Tag
                color="success"
                icon={<CheckCircleOutlined />}
                style={{ fontSize: 14, padding: "4px 10px", fontWeight: 600 }}
              >
                Khớp tiền (0 ₫)
              </Tag>
            ) : (
              <Tag
                color="error"
                icon={<ExclamationCircleOutlined />}
                style={{ fontSize: 14, padding: "4px 10px", fontWeight: 600 }}
              >
                {discrepancy > 0 ? "Thừa tiền: +" : "Thiếu tiền: "}
                {formatVndNumber(discrepancy)} ₫
              </Tag>
            )}
          </div>
        )}

        {/* Alert when discrepancy != 0 */}
        {isDifference && (
          <Alert
            type="warning"
            showIcon
            message="Chênh lệch tiền mặt thực tế và lý thuyết"
            description="Tiền mặt kiểm đếm bị lệch so với sổ sách. Bạn bắt buộc phải nhập lý do giải trình chi tiết trước khi tiếp tục."
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Explanation text area - mandatory when discrepancy != 0 */}
        <Form.Item
          label={
            <Text strong>
              Ghi chú giải trình chênh lệch {isDifference && <span style={{ color: "#ff4d4f" }}>* (Bắt buộc)</span>}
            </Text>
          }
        >
          <Input.TextArea
            rows={3}
            placeholder={
              isDifference
                ? "Bắt buộc nhập lý do chênh lệch (ví dụ: thối nhầm tiền, tiền rách...)"
                : "Ghi chú thêm nếu có..."
            }
            value={explanation}
            onChange={(e) => onExplanationChange(e.target.value)}
            disabled={isReadOnly}
            maxLength={255}
            showCount
          />
        </Form.Item>
      </Form>
    </div>
  );
}
