"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Typography, Card, Button, Space, Row, Col, App } from "antd";
import { PlusOutlined, AppstoreAddOutlined } from "@ant-design/icons";
import { MainLayout } from "@/components/main-layout";
import { CategorySidebar } from "@/components/menu/category-sidebar";
import { MenuTable } from "@/components/menu/menu-table";
import { ItemModal } from "@/components/menu/item-modal";
import { ToppingManagerModal } from "@/components/menu/topping-manager-modal";
import type { CategoryItem, MenuItemRow, ToppingItem } from "@/components/menu/menu-types";

const { Title, Text } = Typography;

export default function AdminMenuPage() {
  const { message } = App.useApp();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [toppings, setToppings] = useState<ToppingItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [isToppingModalOpen, setIsToppingModalOpen] = useState<boolean>(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/menu/categories");
      const data = await res.json();
      if (res.ok && data.data) {
        setCategories(data.data);
      }
    } catch {
      message.error("Lỗi khi tải danh mục món");
    }
  }, [message]);

  const fetchToppings = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/menu/toppings");
      const data = await res.json();
      if (res.ok && data.data) {
        setToppings(data.data);
      }
    } catch {
      message.error("Lỗi khi tải danh sách topping");
    }
  }, [message]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (selectedCategoryId) {
        query.set("categoryId", String(selectedCategoryId));
      }
      if (search.trim()) {
        query.set("search", search.trim());
      }

      const res = await fetch(`/api/v1/menu/items?${query.toString()}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setMenuItems(data.data);
      }
    } catch {
      message.error("Lỗi khi tải danh sách món ăn");
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId, search, message]);

  useEffect(() => {
    fetchCategories();
    fetchToppings();
  }, [fetchCategories, fetchToppings]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItemRow) => {
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  return (
    <MainLayout>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Quản lý thực đơn & Giá bán (SCR-10)
          </Title>
          <Text type="secondary">
            Thiết lập danh mục món, giá bán và bật tắt trạng thái hết món tức thời (FR-15, BR-09, BR-14)
          </Text>
        </div>

        <Space size="middle">
          <Button
            icon={<AppstoreAddOutlined />}
            onClick={() => setIsToppingModalOpen(true)}
            style={{ height: 40 }}
          >
            Quản lý Topping
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenAddModal}
            style={{ height: 40, fontWeight: 600 }}
          >
            Thêm món mới
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6} lg={5}>
          <CategorySidebar
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={(id) => setSelectedCategoryId(id)}
            onCategoryCreated={fetchCategories}
          />
        </Col>

        <Col xs={24} md={18} lg={19}>
          <Card style={{ borderRadius: 8 }}>
            <MenuTable
              items={menuItems}
              loading={loading}
              search={search}
              onSearchChange={setSearch}
              onEditItem={handleOpenEditModal}
              onStatusChanged={fetchItems}
            />
          </Card>
        </Col>
      </Row>

      <ItemModal
        open={isItemModalOpen}
        editingItem={editingItem}
        categories={categories}
        onCancel={() => setIsItemModalOpen(false)}
        onSuccess={() => {
          setIsItemModalOpen(false);
          fetchItems();
        }}
      />

      <ToppingManagerModal
        open={isToppingModalOpen}
        toppings={toppings}
        onClose={() => setIsToppingModalOpen(false)}
        onRefresh={fetchToppings}
      />
    </MainLayout>
  );
}
