"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  InputNumber,
  Button,
  Alert,
  Typography,
  Space,
  Tag,
  Divider,
  App,
  Spin,
} from "antd";
import {
  DollarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { formatVndNumber, parseVnd } from "@/lib/money";

const { Title, Text } = Typography;
const MAX_MONEY = 2_000_000_000;

interface CurrentUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

export default function OpenShiftPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    // 1. Fetch current authenticated user
    fetch("/api/v1/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch((err) => console.error("Failed to load user:", err))
      .finally(() => setLoadingUser(false));

    // 2. Check if cashier already has an active open shift
    fetch("/api/v1/shifts/current")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && data?.data) {
          message.info("Ca làm việc của bạn đang mở. Chuyển sang Sơ đồ bàn...");
          router.replace("/tables");
        }
      })
      .catch(() => {});

    // 3. Live clock display
    const updateTime = () => setCurrentTime(dayjs().format("HH:mm:ss - DD/MM/YYYY"));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [router, message]);

  const handleSubmit = async (values: { tienDauCa: number }) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tienDauCa: values.tienDauCa }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 409) {
          message.warning(data.error || "Ca làm việc đã mở. Chuyển sang Sơ đồ bàn...");
          router.push("/tables");
          return;
        }
        throw new Error(data?.error || "Không thể mở ca làm việc");
      }

      message.success(`Mở ca thành công: ${data.data.shiftCode}`);
      router.push("/tables");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Đã có lỗi xảy ra";
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  const isWaiter = user?.role === "PHUC_VU";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f0f2f5",
        padding: "24px",
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          borderRadius: 8,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <DollarOutlined style={{ fontSize: 36, color: "#1677ff" }} />
          <Title level={3} style={{ marginTop: 8, marginBottom: 4 }}>
            Mở ca làm việc
          </Title>
          <Text type="secondary">
            {isWaiter
              ? "Nhân viên phục vụ cần có ca làm việc đang mở để bắt đầu bán hàng"
              : "Nhập số dư tiền lẻ đầu ca trong két để bắt đầu phiên bán hàng"}
          </Text>
        </div>

        {/* Verbatim Alert according to BR-01 & ERR-01 */}
        <Alert
          message="Yêu cầu mở ca"
          description={ERROR_CATALOG.ERR_01.message}
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />

        <div style={{ background: "#fafafa", padding: "12px 16px", borderRadius: 6, marginBottom: 20 }}>
          <Space direction="vertical" style={{ width: "100%" }} size={4}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text type="secondary">
                <UserOutlined /> Nhân viên:
              </Text>
              <Space>
                <Text strong>{user?.fullName || "Chưa xác định"}</Text>
                <Tag color={isWaiter ? "orange" : "green"}>{user?.role || "THU_NGAN"}</Tag>
              </Space>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text type="secondary">
                <ClockCircleOutlined /> Thời gian:
              </Text>
              <Text>{currentTime}</Text>
            </div>
          </Space>
        </div>

        {/* For PHUC_VU: Do not show form; show guidance Alert per review item 1 */}
        {isWaiter ? (
          <div>
            <Alert
              message="Chưa có ca làm việc đang mở"
              description="Nhân viên phục vụ không thể mở ca. Vui lòng liên hệ thu ngân hoặc quản lý để mở ca làm việc trước khi thực hiện bán hàng."
              type="warning"
              showIcon
              style={{ marginBottom: 20 }}
            />
            <Button
              type="primary"
              size="large"
              block
              icon={<ReloadOutlined />}
              onClick={() => router.push("/tables")}
              style={{ height: 48, fontWeight: 600 }}
            >
              Kiểm tra lại trạng thái ca
            </Button>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            initialValues={{ tienDauCa: 1000000 }}
            onFinish={handleSubmit}
          >
            <Form.Item
              name="tienDauCa"
              label={<Text strong>Số tiền mặt đầu ca (Tiền lẻ trong két)</Text>}
              rules={[
                { required: true, message: "Vui lòng nhập số tiền đầu ca" },
                {
                  validator: async (_, value) => {
                    if (value === undefined || value === null) return;
                    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
                      throw new Error("Số tiền đầu ca phải là số nguyên lớn hơn hoặc bằng 0");
                    }
                    if (value > MAX_MONEY) {
                      throw new Error("Số tiền đầu ca không được vượt quá 2.000.000.000 VNĐ");
                    }
                  },
                },
              ]}
            >
              <InputNumber<number>
                style={{ width: "100%" }}
                size="large"
                placeholder="1.000.000"
                formatter={(value) => (value !== undefined ? formatVndNumber(Number(value)) : "")}
                parser={(displayValue) => (displayValue ? parseVnd(displayValue) : 0)}
                addonAfter="₫"
              />
            </Form.Item>

            <Divider style={{ margin: "16px 0" }} />

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={submitting}
                icon={<CheckCircleOutlined />}
                style={{ height: 48, fontWeight: 600, fontSize: 16 }}
              >
                Xác nhận mở ca
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
}
