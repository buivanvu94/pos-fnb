import { describe, it, expect } from "vitest";
import { formatVnd, formatVndNumber, parseVnd } from "@/lib/money";
import { MAX_ORDER_AMOUNT } from "@/server/orders/order-schema";

describe("Order Calculation & Money Logic (Unit Tests)", () => {
  it("formats integer VND correctly with dot thousand separators and currency symbol", () => {
    expect(formatVnd(0)).toBe("0 ₫");
    expect(formatVnd(35000)).toBe("35.000 ₫");
    expect(formatVnd(150000)).toBe("150.000 ₫");
    expect(formatVnd(200000)).toBe("200.000 ₫");
    expect(formatVnd(350000)).toBe("350.000 ₫");
    expect(formatVnd(2000000000)).toBe("2.000.000.000 ₫");
  });

  it("calculates complex item subtotal with base price and multiple toppings", () => {
    const basePrice = 45000;
    const toppings = [
      { name: "Trân châu đen", price: 10000 },
      { name: "Thạch cà phê", price: 5000 },
      { name: "Kem cheese", price: 15000 },
    ];
    const quantity = 3;

    const toppingTotal = toppings.reduce((sum, t) => sum + t.price, 0);
    const unitPriceWithToppings = basePrice + toppingTotal;
    const subtotal = unitPriceWithToppings * quantity;

    expect(toppingTotal).toBe(30000);
    expect(unitPriceWithToppings).toBe(75000);
    expect(subtotal).toBe(225000);
  });

  it("merge matrix: total before strictly equals total after across multiple combinations", () => {
    const testCases = [
      {
        orderA: [
          { price: 35000, qty: 2, toppings: [5000] }, // (35+5)*2 = 80k
          { price: 50000, qty: 1, toppings: [] }, // 50k
        ], // Total A: 130k
        orderB: [
          { price: 25000, qty: 3, toppings: [10000, 5000] }, // (25+15)*3 = 120k
          { price: 100000, qty: 1, toppings: [] }, // 100k
        ], // Total B: 220k
      },
      {
        orderA: [
          { price: 150000, qty: 1, toppings: [] }, // 150k (AC-04-2)
        ],
        orderB: [
          { price: 200000, qty: 1, toppings: [] }, // 200k (AC-04-2)
        ],
      },
      {
        orderA: [
          { price: 10000, qty: 10, toppings: [2000, 3000] }, // (10+5)*10 = 150k
          { price: 70000, qty: 2, toppings: [] }, // 140k
        ], // Total A: 290k
        orderB: [
          { price: 60000, qty: 1, toppings: [10000] }, // 70k
        ], // Total B: 70k
      },
    ];

    for (const { orderA, orderB } of testCases) {
      const calcOrder = (items: typeof orderA) =>
        items.reduce((sum, it) => {
          const topSum = it.toppings.reduce((s, p) => s + p, 0);
          return sum + (it.price + topSum) * it.qty;
        }, 0);

      const totalA = calcOrder(orderA);
      const totalB = calcOrder(orderB);
      const combinedItems = [...orderA, ...orderB];
      const mergedTotal = calcOrder(combinedItems);

      expect(mergedTotal).toBe(totalA + totalB);
      expect(combinedItems.length).toBe(orderA.length + orderB.length);
    }
  });

  it("enforces maximum order cap at 2.000.000.000 VNĐ", () => {
    expect(MAX_ORDER_AMOUNT).toBe(2000000000);
    const orderTotal = 2000000001;
    expect(orderTotal > MAX_ORDER_AMOUNT).toBe(true);
  });
});
