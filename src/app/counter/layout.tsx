import React from "react";
import { requireOpenShiftPage } from "@/server/shifts/require-open-shift";

export default async function CounterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOpenShiftPage();
  return <>{children}</>;
}
