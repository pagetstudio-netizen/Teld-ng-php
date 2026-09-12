const TELEGRAM_API = "https://api.telegram.org";
import { storage } from "./storage";
import { fromBaseCurrency, getCurrencyCode } from "@shared/currency";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramMessage(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
}

export function formatTelegramValue(value: unknown): string {
  return escapeHtml(value);
}

function formatTelegramAmount(amount: number, countryCode?: string): string {
  const country = countryCode || "PH";
  return `${fromBaseCurrency(amount, country).toLocaleString("en-US")} ${getCurrencyCode(country)}`;
}

async function telegramRequest(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Telegram ${method} HTTP ${response.status}`);
  return response.json() as Promise<{ ok: boolean; result?: any }>;
}

async function handleTelegramCommand(text: string, chatId: string) {
  const command = text.trim().split(/\s+/)[0].toLowerCase().split("@")[0];
  if (command === "/help" || command === "/start") {
    return [
      "🤖 <b>TELD (Tcharging) commands</b>",
      "/stats — platform statistics",
      "/balance — balances and pending amounts",
      "/pending — pending deposits and withdrawals",
      "/help — show this help",
    ].join("\n");
  }
  if (command === "/stats") {
    const stats = await storage.getStats();
    return [
      "📊 <b>Statistics</b>",
      `Users: ${formatTelegramValue(stats.totalUsers)}`,
      `New users today: ${formatTelegramValue(stats.todayUsers)}`,
      `Users with products: ${formatTelegramValue(stats.usersWithProducts)}`,
      `Approved deposits: ${formatTelegramValue(stats.totalDeposits)} PHP base`,
      `Approved withdrawals: ${formatTelegramValue(stats.totalWithdrawals)} PHP base`,
    ].join("\n");
  }
  if (command === "/solde") {
    const stats = await storage.getStats();
    return [
      "💰 <b>Amount status</b>",
      `Pending deposits: ${formatTelegramValue(stats.pendingDeposits)} (${formatTelegramValue(stats.pendingDepositsCount)})`,
      `Pending withdrawals: ${formatTelegramValue(stats.pendingWithdrawals)} (${formatTelegramValue(stats.pendingWithdrawalsCount)})`,
    ].join("\n");
  }
  if (command === "/pending") {
    const [deposits, withdrawals] = await Promise.all([
      storage.getDeposits("pending"),
      storage.getWithdrawals("pending"),
    ]);
    const depositLines = deposits.slice(0, 10).map((item) =>
      `• Deposit #${item.id} — ${formatTelegramValue(formatTelegramAmount(item.amount, item.user?.country))} — ${formatTelegramValue(item.user?.fullName || "User")}`,
    );
    const withdrawalLines = withdrawals.slice(0, 10).map((item) =>
      `• Withdrawal #${item.id} — ${formatTelegramValue(formatTelegramAmount(item.amount, item.user?.country))} — ${formatTelegramValue(item.user?.fullName || "User")}`,
    );
    return [
      "⏳ <b>Pending operations</b>",
      "<b>Deposits</b>",
      ...(depositLines.length ? depositLines : ["No pending deposits"]),
      "<b>Withdrawals</b>",
      ...(withdrawalLines.length ? withdrawalLines : ["No pending withdrawals"]),
    ].join("\n");
  }
  return "Unknown command. Use /help.";
}

export async function sendDailyTelegramSummary(): Promise<void> {
  if (!isTelegramConfigured()) return;
  const stats = await storage.getStats();
  await sendTelegramMessage([
    "📋 <b>Detailed platform summary</b>",
    `Users: ${formatTelegramValue(stats.totalUsers)}`,
    `New users: ${formatTelegramValue(stats.todayUsers)}`,
    `Users with products: ${formatTelegramValue(stats.usersWithProducts)}`,
    `Total balance: ${formatTelegramValue(stats.totalBalance)} PHP base`,
    `Total earnings: ${formatTelegramValue(stats.totalEarnings)} PHP base`,
    `Commissions: ${formatTelegramValue(stats.totalCommissions)} PHP base`,
    `Today's deposits: ${formatTelegramValue(stats.todayDeposits)} PHP base`,
    `Total deposits: ${formatTelegramValue(stats.totalDeposits)} PHP base`,
    `Today's withdrawals: ${formatTelegramValue(stats.todayWithdrawals)} PHP base`,
    `Total withdrawals: ${formatTelegramValue(stats.totalWithdrawals)} PHP base`,
    `Pending deposits: ${formatTelegramValue(stats.pendingDeposits)} PHP base (${formatTelegramValue(stats.pendingDepositsCount)})`,
    `Pending withdrawals: ${formatTelegramValue(stats.pendingWithdrawals)} PHP base (${formatTelegramValue(stats.pendingWithdrawalsCount)})`,
  ].join("\n"));
}

export async function sendTelegramSecurityAlert(ip: string, attemptMessage: string): Promise<void> {
  await sendTelegramMessage([
    "🚨 <b>Security alert</b>",
    "Too many administrator or user login attempts.",
    `Error: <code>${formatTelegramValue(attemptMessage)}</code>`,
    `IP address: <code>${formatTelegramValue(ip)}</code>`,
    "Access temporarily blocked for 15 minutes.",
  ].join("\n"));
}

export function startTelegramBot(): void {
  if (!isTelegramConfigured()) return;
  let updateOffset = 0;
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      const response = await telegramRequest("getUpdates", {
        offset: updateOffset,
        timeout: 0,
        allowed_updates: ["message"],
      });
      for (const update of response?.result || []) {
        updateOffset = Math.max(updateOffset, Number(update.update_id) + 1);
        const message = update.message;
        if (!message?.text || String(message.chat?.id) !== String(process.env.TELEGRAM_CHAT_ID)) continue;
        const reply = await handleTelegramCommand(message.text, String(message.chat.id));
        await telegramRequest("sendMessage", {
          chat_id: message.chat.id,
          text: reply,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[
              { text: "Ouvrir l'administration", url: `${process.env.PUBLIC_APP_URL || ""}/admin` },
            ]],
          },
        });
      }
    } catch (error: any) {
      console.error("[telegram] command polling failed:", error.message);
    } finally {
      polling = false;
    }
  };
  void poll();
  setInterval(() => void poll(), 5000);
}