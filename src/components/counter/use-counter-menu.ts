"use client";

import { useState, useEffect } from "react";
import type { MenuItemData, CategoryData } from "@/components/ordering/menu-grid";
import type { ToppingOption } from "@/components/ordering/item-customizer-drawer";

export interface CounterMenuState {
  currentUser: { role: string; fullName: string } | null;
  menuItems: MenuItemData[];
  categories: CategoryData[];
  toppings: ToppingOption[];
}

export function useCounterMenu(): CounterMenuState {
  const [currentUser, setCurrentUser] = useState<{ role: string; fullName: string } | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [toppings, setToppings] = useState<ToppingOption[]>([]);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});

    fetch("/api/v1/menu/items")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.data)) {
          setMenuItems(data.data.filter((item: any) => item.status === "DANG_BAN"));
        }
      })
      .catch(() => {});

    fetch("/api/v1/menu/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.data)) setCategories(data.data);
      })
      .catch(() => {});

    fetch("/api/v1/menu/toppings")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.data)) setToppings(data.data);
      })
      .catch(() => {});
  }, []);

  return { currentUser, menuItems, categories, toppings };
}
