import { ERROR_CATALOG } from "@/lib/error-catalog";
import type { PrinterSettings } from "./settings-service";
import type { PrintJob } from "@/db/schema";

export interface ResolvedStation {
  targetIp: string;
  stationName: string;
  defaultWarning: string;
}

export function resolveStationAddress(
  job: PrintJob,
  settings: PrinterSettings,
): ResolvedStation {
  let targetIp = settings.kitchenIp;
  let stationName = "Bếp";

  if (job.targetPrinter === "BAR") {
    targetIp = settings.barIp;
    stationName = "Quầy Bar";
  } else if (job.targetPrinter === "RECEIPT") {
    targetIp = settings.receiptIp;
    stationName = "Hóa đơn";
  }

  const defaultWarning =
    job.targetPrinter === "RECEIPT"
      ? ERROR_CATALOG.ERR_10.message
      : ERROR_CATALOG.ERR_06.message;

  return { targetIp, stationName, defaultWarning };
}

export function populatePayloadDefaults(
  rawPayload: string,
  settings: PrinterSettings,
): Record<string, any> {
  let payloadObj: Record<string, any> = {};
  try {
    payloadObj = JSON.parse(rawPayload);
  } catch {
    payloadObj = {};
  }

  if (!payloadObj.storeName) payloadObj.storeName = settings.storeName;
  if (!payloadObj.storeAddress) payloadObj.storeAddress = settings.storeAddress;
  if (!payloadObj.storePhone) payloadObj.storePhone = settings.storePhone;
  if (!payloadObj.storeLogoPath && settings.storeLogo) {
    payloadObj.storeLogoPath = settings.storeLogo;
  }
  if (!payloadObj.wifiSsid) {
    payloadObj.wifiSsid = settings.wifiSsid;
    payloadObj.wifiPassword = settings.wifiPassword;
    payloadObj.wifiSecurity = settings.wifiSecurity;
  }

  return payloadObj;
}
