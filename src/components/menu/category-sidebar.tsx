"use client";

import React, { useState } from "react";
import { Card, Menu, Button, Modal, Form, Input, InputNumber, Typography, Space, App } from "antd";
import { FolderOutlined, AppstoreOutlined, PlusOutlined } from "@ant-design/icons";
import type { CategoryItem } from "./menu-types";

const { Text } = Typography;

interface CategorySidebarProps {
  categories: CategoryItem[];
  selectedCategoryId: number | null;
  onSelectCategory: (id: number | null) => void;
  onCategoryCreated: () => void;
}

export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCategoryCreated,
}: CategorySidebarProps) {
  const { message } = App.useApp();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const handleCreateCategory = async (values: { name: string; displayOrder?: number }) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/menu/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể tạo nhóm món");
      }

      message.success("Tạo nhóm món mới thành công");
      form.resetFields();
      setIsAddModalOpen(false);
      onCategoryCreated();
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || "Lỗi khi tạo nhóm món");
    } finally {
      setSubmitting(false);
    }
  };

  const menuItems = [
    {
      key: "all",
      icon: <AppstoreOutlined />,
      label: "Tất cả món",
      onClick: () => onSelectCategory(null),
    },
    ...categories.map((cat) => ({
      key: String(cat.id),
      icon: <FolderOutlined />,
      label: cat.name,
      onClick: () => onSelectCategory(cat.id),
    })),
  ];

  const selectedKey = selectedCategoryId ? String(selectedCategoryId) : "all";

  return (
    <Card
      title={
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Text strong style={{ fontSize: 16 }}>
            Nhóm thực đơn
          </Text>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Thêm
          </Button>
        </Space>
      }
      styles={{ body: { padding: "8px 0" } }}
      style={{ borderRadius: 8, height: "100%", minHeight: 480 }}
    >
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        style={{ borderRight: "none" }}
      />

      <Modal
        title="Thêm nhóm thực đơn mới"
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateCategory}>
          <Form.Item
            name="name"
            label="Tên nhóm thực đơn"
            rules={[
              { required: true, message: "Vui lòng nhập tên nhóm món" },
              {
                validator: (_, value) =>
                  !value || value.trim().length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error("Tên nhóm không được để trống")),
              },
            ]}
          >
            <Input placeholder="Ví dụ: Cà phê, Nước ép, Ăn vặt..." />
          </Form.Item>
          <Form.Item name="displayOrder" label="Thứ tự hiển thị" initialValue={0}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
