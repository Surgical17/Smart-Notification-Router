import { prisma } from "@/lib/prisma";
import { RuleAction } from "@/lib/validations/webhook";
import { processTemplate } from "@/lib/rule-engine";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface NotificationResult {
  channelId: string;
  channelName: string;
  success: boolean;
  error?: string;
}

interface ChannelConfig {
  // Gotify
  url?: string;
  token?: string;

  // Email (SMTP)
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  to?: string;

  // Telegram
  botToken?: string;
  chatId?: string;

  // Discord
  webhookUrl?: string;

  // Slack
  // webhookUrl is shared with Discord

  // Generic Apprise URL
  appriseUrl?: string;

  // Custom webhook
  // url is shared with Gotify
  method?: string;
  headers?: Record<string, string>;
}

// Check if Apprise CLI is available
let appriseAvailable: boolean | null = null;

async function checkAppriseAvailable(): Promise<boolean> {
  if (appriseAvailable !== null) {
    return appriseAvailable;
  }

  try {
    await execAsync("apprise --version", { timeout: 5000 });
    appriseAvailable = true;
    return true;
  } catch {
    appriseAvailable = false;
    return false;
  }
}

// Build Apprise URL from channel configuration
function buildAppriseUrl(type: string, config: ChannelConfig): string | null {
  switch (type) {
    case "gotify":
      if (config.url && config.token) {
        const url = new URL(config.url);
        return `gotify://${url.host}${url.pathname}${config.token}`;
      }
      break;

    case "telegram":
      if (config.botToken && config.chatId) {
        return `tgram://${config.botToken}/${config.chatId}`;
      }
      break;

    case "discord":
      if (config.webhookUrl) {
        const match = config.webhookUrl.match(/\/webhooks\/(\d+)\/([a-zA-Z0-9_-]+)/);
        if (match) {
          return `discord://${match[1]}/${match[2]}`;
        }
      }
      break;

    case "slack":
      if (config.webhookUrl) {
        const match = config.webhookUrl.match(/\/services\/([A-Z0-9]+)\/([A-Z0-9]+)\/([a-zA-Z0-9]+)/);
        if (match) {
          return `slack://${match[1]}/${match[2]}/${match[3]}`;
        }
      }
      break;

    case "email":
      if (config.host && config.user && config.pass && config.to) {
        const port = config.port || (config.secure ? 465 : 587);
        return `mailto://${encodeURIComponent(config.user)}:${encodeURIComponent(config.pass)}@${config.host}:${port}?to=${encodeURIComponent(config.to)}`;
      }
      break;

    case "apprise_url":
      if (config.appriseUrl) {
        return config.appriseUrl;
      }
      break;

    case "webhook":
    case "smart_router":
      if (config.url) {
        const url = new URL(config.url);
        return `json://${url.host}${url.pathname}`;
      }
      break;
  }

  return null;
}

// Send notification using Apprise CLI
async function sendViaApprise(
  url: string,
  title: string,
  message: string,
  priority: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const typeMap: Record<string, string> = {
      low: "info",
      normal: "info",
      high: "warning",
      urgent: "failure",
    };
    const notifyType = typeMap[priority] || "info";

    // Escape special characters for shell
    const escapedTitle = title.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const escapedMessage = message.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const escapedUrl = url.replace(/"/g, '\\"');

    const command = `apprise -t "${escapedTitle}" -b "${escapedMessage}" --notification-type=${notifyType} "${escapedUrl}"`;

    await execAsync(command, { timeout: 30000 });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Apprise error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Send notification via HTTP (works without Apprise installed)
async function sendViaHttp(
  type: string,
  config: ChannelConfig,
  title: string,
  message: string,
  priority: string
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (type) {
      case "gotify": {
        if (!config.url || !config.token) {
          return { success: false, error: "Missing Gotify URL or token" };
        }

        const priorityMap: Record<string, number> = {
          low: 2,
          normal: 5,
          high: 7,
          urgent: 10,
        };

        const response = await fetch(`${config.url}/message?token=${config.token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            message,
            priority: priorityMap[priority] || 5,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          return { success: false, error: `Gotify returned ${response.status}: ${errorText}` };
        }
        return { success: true };
      }

      case "discord": {
        if (!config.webhookUrl) {
          return { success: false, error: "Missing Discord webhook URL" };
        }

        const response = await fetch(config.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `**${title}**\n${message}`,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          return { success: false, error: `Discord returned ${response.status}: ${errorText}` };
        }
        return { success: true };
      }

      case "slack": {
        if (!config.webhookUrl) {
          return { success: false, error: "Missing Slack webhook URL" };
        }

        const response = await fetch(config.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `*${title}*\n${message}`,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          return { success: false, error: `Slack returned ${response.status}: ${errorText}` };
        }
        return { success: true };
      }

      case "telegram": {
        if (!config.botToken || !config.chatId) {
          return { success: false, error: "Missing Telegram bot token or chat ID" };
        }

        const response = await fetch(
          `https://api.telegram.org/bot${config.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: config.chatId,
              text: `<b>${title}</b>\n${message}`,
              parse_mode: "HTML",
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const errorDesc = (errorBody as { description?: string }).description || `Status ${response.status}`;
          return { success: false, error: `Telegram error: ${errorDesc}` };
        }
        return { success: true };
      }

      case "webhook":
      case "smart_router": {
        if (!config.url) {
          return { success: false, error: "Missing webhook URL" };
        }

        const response = await fetch(config.url, {
          method: config.method || "POST",
          headers: {
            "Content-Type": "application/json",
            ...config.headers,
          },
          body: JSON.stringify({
            title,
            message,
            priority,
            timestamp: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          return { success: false, error: `Webhook returned ${response.status}: ${errorText}` };
        }
        return { success: true };
      }

      case "email": {
        // Email requires Apprise or a dedicated email library
        return { success: false, error: "Email requires Apprise CLI. Install with: pip install apprise" };
      }

      case "apprise_url": {
        // Apprise URL requires Apprise CLI
        return { success: false, error: "Apprise URL requires Apprise CLI. Install with: pip install apprise" };
      }

      default:
        return { success: false, error: `Unsupported channel type: ${type}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

// Main function to dispatch notifications
export async function dispatchNotifications(
  actions: RuleAction,
  payload: Record<string, unknown>
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  // Get all channels
  const channels = await prisma.notificationChannel.findMany({
    where: {
      id: { in: actions.channelIds },
      enabled: true,
    },
  });

  // Process templates
  const title = actions.titleTemplate
    ? processTemplate(actions.titleTemplate, payload)
    : "Notification";
  const message = processTemplate(actions.messageTemplate, payload);
  const priority = actions.priority || "normal";

  // Check if Apprise is available (only check once)
  const useApprise = await checkAppriseAvailable();

  // Send to each channel
  for (const channel of channels) {
    const config = JSON.parse(channel.config) as ChannelConfig;
    let result: { success: boolean; error?: string };

    // For channels with native HTTP support, use HTTP directly (faster, no dependency)
    const httpSupportedTypes = ["gotify", "telegram", "discord", "slack", "webhook"];

    if (httpSupportedTypes.includes(channel.type)) {
      // Use HTTP directly for these channel types
      result = await sendViaHttp(channel.type, config, title, message, priority);
    } else if (useApprise) {
      // Use Apprise for email and apprise_url types
      const appriseUrl = buildAppriseUrl(channel.type, config);
      if (appriseUrl) {
        result = await sendViaApprise(appriseUrl, title, message, priority);
      } else {
        result = { success: false, error: "Could not build Apprise URL" };
      }
    } else {
      // No Apprise available, and channel type needs it
      result = await sendViaHttp(channel.type, config, title, message, priority);
    }

    results.push({
      channelId: channel.id,
      channelName: channel.name,
      ...result,
    });
  }

  return results;
}

// Test a notification channel
export async function testNotificationChannel(
  channelId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const channel = await prisma.notificationChannel.findFirst({
    where: {
      id: channelId,
      userId,
    },
  });

  if (!channel) {
    return { success: false, error: "Channel not found" };
  }

  const config = JSON.parse(channel.config) as ChannelConfig;
  const title = "Test Notification";
  const message = "This is a test notification from Smart Notification Router.";

  // For channels with native HTTP support, use HTTP directly
  const httpSupportedTypes = ["gotify", "telegram", "discord", "slack", "webhook"];

  if (httpSupportedTypes.includes(channel.type)) {
    return sendViaHttp(channel.type, config, title, message, "normal");
  }

  // Check if Apprise is available for other channel types
  const useApprise = await checkAppriseAvailable();

  if (useApprise) {
    const appriseUrl = buildAppriseUrl(channel.type, config);
    if (appriseUrl) {
      return sendViaApprise(appriseUrl, title, message, "normal");
    }
  }

  // Fallback
  return sendViaHttp(channel.type, config, title, message, "normal");
}
