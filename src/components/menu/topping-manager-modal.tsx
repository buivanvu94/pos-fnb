"use client";

import React, { useState } from "react";
import {
  Modal,
  Table,
  Button,
  Form,
  Input,
  InputNumber,
  Space,
  Tag,
  App,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatVnd } from "@/lib/money";
import type { ToppingItem } from "./menu-types";

interface ToppingManagerModalProps {
  open: boolean;
  toppings: ToppingItem[];
  onClose: () => void;
  onRefresh: () => void;
}

export function ToppingManagerModal({
  open,
  toppings,
  onClose,
  onRefresh,
}: ToppingManagerModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [adding, setAdding] = useState(false);

  const handleCreateTopping = async (values: { name: string; price: number }) => {
    setAdding(true);
    try {
      const res = await fetch("/api/v1/menu/toppings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          price: values.price || 0,
          isAvailable: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể tạo topping mới");
      }

      message.success("Tạo topping thành công");
      form.resetFields();
      onRefresh();
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || "Lỗi khi tạo topping");
    } finally {
      setAdding(false);
    }
  };

  const columns = [
    {
      title: "Tên topping",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: "Giá thêm",
      dataIndex: "price",
      key: "price",
      width: 130,
      align: "right" as const,
      render: (price: number) => formatVnd(price),
    },
    {
      title: "Trạng thái",
      dataIndex: "isAvailable",
      key: "isAvailable",
      width: 120,
      render: (avail: boolean) => (
        <Tag color={avail ? "green" : "default"}>
          {avail ? "Khả dụng" : "Tạm ngưng"}
        </Tag>
      ),
    },
  ];

  return (
    <Modal
      title="Quản lý món ăn kèm / Topping (FR-02)"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Đóng
        </Button>,
      ]}
      width={650}
    >
      <div style={{ marginBottom: 16, padding: 12, background: "#fafafa", borderRadius: 6 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={handleCreateTopping}
          initialValues={{ price: 5000 }}
        >
          <Form.Item
            name="name"
            rules={[
              { required: true, message: "Nhập tên topping" },
              {
                validator: (_, value) =>
                  !value || value.trim().length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error("Tên topping không được để trống")),
              },
            ]}
          >
            <Input placeholder="Tên topping (Trân châu, Thạch...)" style={{ width: 220 }} />
          </Form.Item>

          <Form.Item
            name="price"
            rules={[
              {
                validator: (_, value) => {
                  if (value !== undefined && value !== null && value < 0) {
                    return Promise.reject(new Error("Đơn giá topping không được nhỏ hơn 0 VNĐ"));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              placeholder="Đơn giá"
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              parser={(val) => (val ? Number(val.replace(/\D/g, "")) : 0)}
              addonAfter="₫"
              style={{ width: 150 }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              htmlType="submit"
              loading={adding}
            >
              Thêm
            </Button>
          </Form.Item>
        </Form>
      </div>

      <Table
        columns={columns}
        dataSource={toppings}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        size="small"
      />
    </Modal>
  );
}
