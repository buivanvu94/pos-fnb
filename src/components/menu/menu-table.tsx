"use client";

import React, { useState } from "react";
import { Table, Input, Switch, Button, Space, Tag, Avatar, Typography, App } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined, EditOutlined, PictureOutlined } from "@ant-design/icons";
import { formatVnd } from "@/lib/money";
import type { MenuItemRow } from "./menu-types";

const { Text } = Typography;

interface MenuTableProps {
  items: MenuItemRow[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onEditItem: (item: MenuItemRow) => void;
  onStatusChanged: () => void;
}

export function MenuTable({
  items,
  loading,
  search,
  onSearchChange,
  onEditItem,
  onStatusChanged,
}: MenuTableProps) {
  const { message } = App.useApp();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const handleToggleStatus = async (item: MenuItemRow, checked: boolean) => {
    // checked = true means DANG_BAN, false means HET_HANG
    const newStatus: "DANG_BAN" | "HET_HANG" = checked ? "DANG_BAN" : "HET_HANG";
    setUpdatingId(item.id);

    try {
      const res = await fetch(`/api/v1/menu/items/${item.id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể cập nhật trạng thái");
      }

      message.success(
        `Đã chuyển "${item.name}" sang ${newStatus === "DANG_BAN" ? "Đang bán" : "Hết hàng"}`,
      );
      onStatusChanged();
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || "Lỗi khi đổi trạng thái món");
    } finally {
      setUpdatingId(null);
    }
  };

  const columns: ColumnsType<MenuItemRow> = [
    {
      title: "Mã món",
      dataIndex: "code",
      key: "code",
      width: 120,
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: "Ảnh & Tên món",
      key: "name",
      render: (_, record) => (
        <Space size="middle">
          <Avatar
            shape="square"
            size={48}
            src={record.imageUrl}
            icon={<PictureOutlined />}
            style={{ backgroundColor: "#f0f0f0", flexShrink: 0 }}
          />
          <div>
            <Text strong style={{ fontSize: 15, display: "block" }}>
              {record.name}
            </Text>
            <Space size="small">
              <Tag color="cyan">{record.unit}</Tag>
              {record.targetPrinter === "BAR" ? (
                <Tag color="purple">Quầy Bar</Tag>
              ) : (
                <Tag color="orange">Bếp</Tag>
              )}
            </Space>
          </div>
        </Space>
      ),
    },
    {
      title: "Nhóm",
      dataIndex: "categoryName",
      key: "categoryName",
      width: 150,
      render: (cat: string) => <Tag color="blue">{cat || "Khác"}</Tag>,
    },
    {
      title: "Đơn giá",
      dataIndex: "price",
      key: "price",
      width: 130,
      align: "right",
      render: (price: number) => (
        <Text strong style={{ color: "#d4380d", fontSize: 15 }}>
          {formatVnd(price)}
        </Text>
      ),
    },
    {
      title: "Trạng thái bán",
      key: "status",
      width: 150,
      align: "center",
      render: (_, record) => {
        const isAvailable = record.status === "DANG_BAN";
        const isPending = updatingId === record.id;
        return (
          <Space direction="vertical" size={2}>
            <Switch
              checked={isAvailable}
              loading={isPending}
              checkedChildren="Đang bán"
              unCheckedChildren="Hết hàng"
              onChange={(checked) => handleToggleStatus(record, checked)}
            />
          </Space>
        );
      },
    },
    {
      title: "Thao tác",
      key: "action",
      width: 90,
      align: "center",
      render: (_, record) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={() => onEditItem(record)}
        >
          Sửa
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
          placeholder="Tìm kiếm theo tên món hoặc mã món..."
          allowClear
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ maxWidth: 360, height: 40 }}
        />
      </div>

      <Table<MenuItemRow>
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `Tổng cộng ${total} món`,
          showSizeChanger: true,
        }}
        bordered
      />
    </div>
  );
}
