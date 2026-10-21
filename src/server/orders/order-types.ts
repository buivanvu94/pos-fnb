/**
 * Type definitions for order items and order details.
 */

export interface OrderItemDetail {
  id: number;
  orderId: number;
  menuItemId: number;
  menuItemName: string;
  menuItemCode: string;
  unitPrice: number;
  quantity: number;
  notes: string | null;
  isPrintedKitchen: boolean;
  sentAt: Date | null;
  isCancelled: boolean;
  targetPrinter: string;
  imageUrl: string | null;
  toppings: Array<{
    id: number;
    toppingId: number;
    toppingName: string;
    toppingPrice: number;
  }>;
  totalItemPrice: number;
}

export interface OrderDetail {
  id: number;
  orderCode: string;
  orderType: string;
  tableId: number | null;
  tableName: string | null;
  areaId: number | null;
  areaName: string | null;
  shiftId: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: string | null;
  status: string;
  version: number;
  createdAt: Date;
  items: OrderItemDetail[];
}
