"use client";

import React, { useState, useEffect } from "react";
import { Modal, Form, Input, InputNumber, Select, Radio, Upload, Button, Image, App } from "antd";
import { UploadOutlined, PlusOutlined } from "@ant-design/icons";
import type { UploadChangeParam } from "antd/es/upload";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import type { CategoryItem, MenuItemRow } from "./menu-types";

interface ItemModalProps {
  open: boolean;
  editingItem: MenuItemRow | null;
  categories: CategoryItem[];
  onCancel: () => void;
  onSuccess: () => void;
}

export function ItemModal({ open, editingItem, categories, onCancel, onSuccess }: ItemModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.setFieldsValue({
          name: editingItem.name,
          code: editingItem.code,
          categoryId: editingItem.categoryId,
          price: editingItem.price,
          unit: editingItem.unit,
          status: editingItem.status,
          targetPrinter: editingItem.targetPrinter,
        });
        setImageUrl(editingItem.imageUrl);
      } else {
        form.resetFields();
        form.setFieldsValue({
          unit: "Phần",
          status: "DANG_BAN",
          targetPrinter: "KITCHEN",
          price: 0,
          categoryId: categories[0]?.id,
        });
        setImageUrl(null);
      }
    }
  }, [open, editingItem, categories, form]);

  const handleUploadChange = (info: UploadChangeParam) => {
    if (info.file.status === "done" && info.file.response?.data?.url) {
      setImageUrl(info.file.response.data.url);
      message.success("Tải ảnh lên thành công");
    } else if (info.file.status === "error") {
      message.error(info.file.response?.error || "Lỗi khi tải ảnh lên");
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const url = editingItem ? `/api/v1/menu/items/${editingItem.id}` : "/api/v1/menu/items";
      const method = editingItem ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu thông tin món ăn");

      message.success(editingItem ? "Cập nhật món thành công" : "Tạo món thành công");
      onSuccess();
    } catch (err: unknown) {
      message.error((err as Error).message || "Lỗi khi lưu món ăn");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingItem ? `Chỉnh sửa món: ${editingItem.name}` : "Thêm món mới"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="name"
          label="Tên món ăn / đồ uống"
          rules={[
            { required: true, message: "Tên món ăn không được để trống" },
            {
              validator: (_, val) =>
                !val || val.trim().length > 0 ? Promise.resolve() : Promise.reject(new Error("Tên món ăn không được để trống")),
            },
          ]}
        >
          <Input placeholder="Ví dụ: Trà đào cam sả, Cà phê sữa..." />
        </Form.Item>

        <Form.Item name="categoryId" label="Nhóm món" rules={[{ required: true, message: "Chọn nhóm món" }]}>
          <Select placeholder="Chọn nhóm thực đơn" options={categories.map((c) => ({ label: c.name, value: c.id }))} />
        </Form.Item>

        <Form.Item
          name="price"
          label="Đơn giá (VNĐ)"
          rules={[
            {
              validator: (_, val) => {
                if (val === undefined || val === null || val === "") {
                  return Promise.reject(new Error("Đơn giá món ăn không được để trống"));
                }
                if (Number(val) < 0) return Promise.reject(new Error(ERROR_CATALOG.ERR_12.message));
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
            parser={(val) => (val ? Number(val.replace(/\D/g, "")) : 0)}
            addonAfter="₫"
          />
        </Form.Item>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item name="unit" label="Đơn vị tính" initialValue="Phần">
            <Input placeholder="Phần, Ly, Đĩa, Chai..." />
          </Form.Item>
          <Form.Item name="targetPrinter" label="Nơi chế biến / In KOT" initialValue="KITCHEN">
            <Select options={[{ label: "Bếp nấu (KITCHEN)", value: "KITCHEN" }, { label: "Quầy Bar (BAR)", value: "BAR" }]} />
          </Form.Item>
        </div>

        <Form.Item label="Hình ảnh món ăn">
          <Upload name="file" action="/api/v1/menu/upload" showUploadList={false} accept="image/png,image/jpeg,image/webp" onChange={handleUploadChange}>
            {imageUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Image
                  src={imageUrl}
                  alt="Ảnh món"
                  width={60}
                  height={60}
                  style={{ objectFit: "cover", borderRadius: 4 }}
                  preview={false}
                />
                <Button icon={<UploadOutlined />}>Đổi ảnh khác</Button>
              </div>
            ) : (
              <Button icon={<PlusOutlined />}>Tải ảnh lên (Max 2MB)</Button>
            )}
          </Upload>
        </Form.Item>

        <Form.Item name="status" label="Trạng thái" initialValue="DANG_BAN">
          <Radio.Group>
            <Radio value="DANG_BAN">Đang bán</Radio>
            <Radio value="HET_HANG">Hết hàng</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
