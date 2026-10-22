import type { ShiftCloseTelegramPayload } from "./outbox-types";
import { formatShiftCloseTelegramMessage } from "./telegram-formatter";

export interface SendTelegramOptions {
  botToken?: string;
  chatId?: string;
  apiBaseUrl?: string;
}

export interface SendTelegramResult {
  ok: boolean;
  error?: string;
}

/**
 * Sanitizes any string to ensure the Telegram bot token is never exposed.
 */
function sanitizeError(message: string, token?: string): string {
  if (!token) return message;
  return message.split(token).join("[REDACTED_BOT_TOKEN]");
}

/**
 * Sends a Telegram message using Bot API sendMessage.
 * Strictly reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment variables.
 * Token is NEVER logged or included in return errors.
 */
export async function sendTelegramNotification(
  payload: ShiftCloseTelegramPayload,
  options?: SendTelegramOptions,
): Promise<SendTelegramResult> {
  const token = options?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options?.chatId || process.env.TELEGRAM_CHAT_ID;
  const apiBase =
    options?.apiBaseUrl ||
    process.env.TELEGRAM_API_BASE_URL ||
    "https://api.telegram.org";

  if (!token || !chatId) {
    return {
      ok: false,
      error: "Telegram bot token or chat ID is not configured in environment",
    };
  }

  const messageText = formatShiftCloseTelegramMessage(payload);
  const url = `${apiBase.replace(/\/$/, "")}/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      const cleanError = sanitizeError(
        `Telegram API error HTTP ${response.status}: ${errBody.slice(0, 200)}`,
        token,
      );
      return { ok: false, error: cleanError };
    }

    const data = await response.json().catch(() => ({ ok: true }));
    if (!data.ok) {
      const cleanError = sanitizeError(
        `Telegram response error: ${data.description || "Unknown error"}`,
        token,
      );
      return { ok: false, error: cleanError };
    }

    return { ok: true };
  } catch (err: unknown) {
    const isTimeout =
      (err as any)?.name === "TimeoutError" ||
      (err as any)?.name === "AbortError" ||
      String(err).toLowerCase().includes("timeout");
    const rawError = isTimeout
      ? "Telegram request timed out after 30s"
      : err instanceof Error
      ? err.message
      : String(err);
    const cleanError = sanitizeError(`Network error: ${rawError}`, token);
    return { ok: false, error: cleanError };
  }
}
