"use client";

import { useState, useEffect } from "react";
import type { MenuItemData, CategoryData } from "@/components/ordering/menu-grid";
import type { ToppingOption } from "@/components/ordering/item-customizer-drawer";

interface MenuCache {
  items: MenuItemData[];
  categories: CategoryData[];
  toppings: ToppingOption[];
  fetchedAt: number;
}

let cachedData: MenuCache | null = null;
let activePromise: Promise<MenuCache> | null = null;

export async function fetchMenuData(force = false): Promise<MenuCache> {
  const CACHE_TTL = 60 * 1000; // 1 minute in-memory cache
  if (!force && cachedData && Date.now() - cachedData.fetchedAt < CACHE_TTL) {
    return cachedData;
  }

  if (activePromise) {
    return activePromise;
  }

  activePromise = (async () => {
    try {
      const [itemsRes, catRes, topRes] = await Promise.all([
        fetch("/api/v1/menu/items").then((r) => r.json()).catch(() => ({ ok: false })),
        fetch("/api/v1/menu/categories").then((r) => r.json()).catch(() => ({ ok: false })),
        fetch("/api/v1/menu/toppings").then((r) => r.json()).catch(() => ({ ok: false })),
      ]);

      cachedData = {
        items: itemsRes.ok && Array.isArray(itemsRes.data) ? itemsRes.data : [],
        categories: catRes.ok && Array.isArray(catRes.data) ? catRes.data : [],
        toppings: topRes.ok && Array.isArray(topRes.data) ? topRes.data : [],
        fetchedAt: Date.now(),
      };
      return cachedData;
    } finally {
      activePromise = null;
    }
  })();

  return activePromise;
}

export function invalidateMenuCache() {
  cachedData = null;
}

export function useMenuCache() {
  const [items, setItems] = useState<MenuItemData[]>(cachedData?.items ?? []);
  const [categories, setCategories] = useState<CategoryData[]>(cachedData?.categories ?? []);
  const [toppings, setToppings] = useState<ToppingOption[]>(cachedData?.toppings ?? []);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    fetchMenuData().then((data) => {
      setItems(data.items);
      setCategories(data.categories);
      setToppings(data.toppings);
      setLoading(false);
    });
  }, []);

  return { items, categories, toppings, loading, refresh: () => fetchMenuData(true) };
}
