import React, { useState, useMemo } from "react";
import { Tabs, Row, Col, Empty, Card } from "antd";
import { AppstoreOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { TableCard } from "./table-card";
import type { TableWithOrderInfo } from "@/server/tables/table-service";

interface TableGridProps {
  tables: TableWithOrderInfo[];
  selectedTableId?: number | null;
  onSelectTable: (table: TableWithOrderInfo) => void;
}

export function TableGrid({ tables, selectedTableId, onSelectTable }: TableGridProps) {
  // Extract unique areas
  const areas = useMemo(() => {
    const map = new Map<number, { id: number; name: string; displayOrder: number }>();
    for (const t of tables) {
      if (!map.has(t.areaId)) {
        map.set(t.areaId, {
          id: t.areaId,
          name: t.areaName || `Khu vực ${t.areaId}`,
          displayOrder: t.areaDisplayOrder,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }, [tables]);

  const [activeAreaId, setActiveAreaId] = useState<string>(
    areas[0]?.id ? String(areas[0].id) : "all",
  );

  const filteredTables = useMemo(() => {
    if (activeAreaId === "all") return tables;
    const numId = Number(activeAreaId);
    return tables.filter((t) => t.areaId === numId);
  }, [tables, activeAreaId]);

  const tabItems = useMemo(() => {
    const list = [
      {
        key: "all",
        icon: <AppstoreOutlined />,
        label: `Tất cả (${tables.length})`,
      },
      ...areas.map((a) => {
        const count = tables.filter((t) => t.areaId === a.id).length;
        return {
          key: String(a.id),
          icon: <EnvironmentOutlined />,
          label: `${a.name} (${count})`,
        };
      }),
    ];
    return list;
  }, [areas, tables]);

  return (
    <div>
      <Tabs
        activeKey={activeAreaId}
        onChange={setActiveAreaId}
        items={tabItems}
        style={{ marginBottom: 16 }}
      />

      {filteredTables.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 32 }}>
          <Empty description="Không có bàn nào trong khu vực này" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredTables.map((table) => (
            <Col xs={12} sm={8} md={6} lg={4} key={table.id}>
              <TableCard
                table={table}
                isSelected={selectedTableId === table.id}
                onClick={onSelectTable}
              />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
