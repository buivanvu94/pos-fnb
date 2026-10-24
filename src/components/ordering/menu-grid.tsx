import React, { useState, useMemo } from "react";
import { Segmented, Row, Col, Card, Tag, Typography, Button, Space, Empty } from "antd";
import { PlusOutlined, SettingOutlined, CoffeeOutlined } from "@ant-design/icons";
import { formatVnd } from "@/lib/money";

const { Text, Title } = Typography;

export interface MenuItemData {
  id: number;
  code: string;
  name: string;
  price: number;
  unit: string;
  status: "DANG_BAN" | "HET_HANG";
  imageUrl: string | null;
  categoryId: number;
  categoryName?: string;
  targetPrinter: string;
}

export interface CategoryData {
  id: number;
  code: string;
  name: string;
}

interface MenuGridProps {
  items: MenuItemData[];
  categories: CategoryData[];
  loading?: boolean;
  onQuickAddItem: (item: MenuItemData) => void;
  onCustomizeItem: (item: MenuItemData) => void;
}

export function MenuGrid({
  items,
  categories,
  loading = false,
  onQuickAddItem,
  onCustomizeItem,
}: MenuGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categoryOptions = useMemo(() => {
    return [
      { label: `Tất cả (${items.length})`, value: "all" },
      ...categories.map((c) => ({
        label: `${c.name} (${items.filter((i) => i.categoryId === c.id).length})`,
        value: String(c.id),
      })),
    ];
  }, [categories, items]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return items;
    const catId = Number(selectedCategory);
    return items.filter((i) => i.categoryId === catId);
  }, [items, selectedCategory]);

  return (
    <div>
      <div style={{ marginBottom: 16, overflowX: "auto" }}>
        <Segmented
          options={categoryOptions}
          value={selectedCategory}
          onChange={(val) => setSelectedCategory(String(val))}
          size="large"
        />
      </div>

      {filteredItems.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <Empty description="Không có món nào trong danh mục này" />
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          {filteredItems.map((item) => {
            const isOutOfStock = item.status === "HET_HANG";

            return (
              <Col xs={12} sm={8} md={6} lg={4} key={item.id}>
                <Card
                  hoverable={!isOutOfStock}
                  cover={
                    item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", filter: isOutOfStock ? "grayscale(1)" : undefined }}
                      />
                    ) : (
                      <div
                        aria-hidden
                        style={{ width: "100%", aspectRatio: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", color: "#bfbfbf", fontSize: 32 }}
                      >
                        <CoffeeOutlined />
                      </div>
                    )
                  }
                  onClick={() => !isOutOfStock && onQuickAddItem(item)}
                  style={{
                    borderRadius: 8,
                    cursor: isOutOfStock ? "not-allowed" : "pointer",
                    opacity: isOutOfStock ? 0.55 : 1,
                    border: isOutOfStock ? "1px dashed #d9d9d9" : "1px solid #f0f0f0",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  styles={{
                    body: {
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      justifyContent: "space-between",
                    },
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <Title level={5} style={{ margin: 0, fontSize: 14 }}>
                        {item.name}
                      </Title>
                      {isOutOfStock && <Tag color="error">Hết hàng</Tag>}
                    </div>

                    <Text strong style={{ color: "#1677ff", fontSize: 15 }}>
                      {formatVnd(item.price)}
                    </Text>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.unit}
                    </Text>
                    <Space size={4}>
                      <Button
                        size="small"
                        aria-label={`Tùy chỉnh ${item.name}`}
                        icon={<SettingOutlined />}
                        disabled={isOutOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCustomizeItem(item);
                        }}
                      />
                      <Button
                        type="primary"
                        size="small"
                        aria-label={`Thêm ${item.name}`}
                        icon={<PlusOutlined />}
                        disabled={isOutOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAddItem(item);
                        }}
                      />
                    </Space>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
