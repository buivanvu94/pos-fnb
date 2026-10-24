"use client";

import { useState, useEffect } from "react";
import type { MenuItemData, CategoryData } from "@/components/ordering/menu-grid";
import type { ToppingOption } from "@/components/ordering/item-customizer-drawer";
import { useMenuCache } from "@/components/menu/use-menu-cache";

export interface CounterMenuState {
  currentUser: { role: string; fullName: string } | null;
  menuItems: MenuItemData[];
  categories: CategoryData[];
  toppings: ToppingOption[];
}

export function useCounterMenu(): CounterMenuState {
  const [currentUser, setCurrentUser] = useState<{ role: string; fullName: string } | null>(null);
  const { items, categories, toppings } = useMenuCache();

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const availableItems = items.filter((item) => item.status === "DANG_BAN");

  return { currentUser, menuItems: availableItems, categories, toppings };
}
