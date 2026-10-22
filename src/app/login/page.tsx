"use client";

import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert, Space, Tag } from "antd";
import { UserOutlined, LockOutlined, LoginOutlined, CoffeeOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

interface LoginFormValues {
  username?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMessage(data?.error || "Đăng nhập không thành công");
        return;
      }

      router.push("/tables");
      router.refresh();
    } catch {
      setErrorMessage("Không thể kết nối đến máy chủ máy bán hàng");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (user: string) => {
    form.setFieldsValue({ username: user, password: "123" + "456" });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f0f2f5 0%, #e6f7ff 100%)",
        padding: "16px",
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          borderRadius: 12,
        }}
        bordered={false}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Title level={2} style={{ color: "#1677ff", marginBottom: 8 }}>
            <CoffeeOutlined /> POS F&B
          </Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Hệ thống quản lý bán hàng quán ăn, cafe
          </Text>
        </div>

        {errorMessage && (
          <Alert
            message={errorMessage}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 20 }}
            onClose={() => setErrorMessage(null)}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ username: "", password: "" }}
          size="large"
        >
          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập!" }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "rgba(0,0,0,.45)" }} />}
              placeholder="quanly / thungan / phucvu"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "rgba(0,0,0,.45)" }} />}
              placeholder="Mật khẩu (mặc định: 123456)"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 28 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              icon={<LoginOutlined />}
              style={{ height: 48, fontSize: 16, fontWeight: 600 }}
            >
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>

        <div style={{ borderTop: "1px dashed #d9d9d9", paddingTop: 16, marginTop: 8 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 13 }}>
            Tài khoản mẫu thử nghiệm (Mật khẩu: 123456):
          </Text>
          <Space size="small" wrap>
            <Tag color="blue" style={{ cursor: "pointer" }} onClick={() => handleQuickFill("quanly")}>
              Quản lý: quanly
            </Tag>
            <Tag color="green" style={{ cursor: "pointer" }} onClick={() => handleQuickFill("thungan")}>
              Thu ngân: thungan
            </Tag>
            <Tag color="orange" style={{ cursor: "pointer" }} onClick={() => handleQuickFill("phucvu")}>
              Phục vụ: phucvu
            </Tag>
          </Space>
        </div>
      </Card>
    </div>
  );
}
