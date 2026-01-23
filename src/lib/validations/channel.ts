import { z } from "zod";

export const channelTypes = [
  "gotify",
  "telegram",
  "discord",
  "slack",
  "email",
  "apprise_url",
  "webhook",
  "smart_router",
] as const;

export const channelTypeSchema = z.enum(channelTypes);

// Type-specific config schemas
const gotifyConfigSchema = z.object({
  url: z.string().url("Invalid URL"),
  token: z.string().min(1, "Token is required"),
});

const telegramConfigSchema = z.object({
  botToken: z.string().min(1, "Bot token is required"),
  chatId: z.string().min(1, "Chat ID is required"),
});

const discordConfigSchema = z.object({
  webhookUrl: z.string().url("Invalid webhook URL"),
});

const slackConfigSchema = z.object({
  webhookUrl: z.string().url("Invalid webhook URL"),
});

const emailConfigSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().optional().default(false),
  user: z.string().min(1, "Username is required"),
  pass: z.string().min(1, "Password is required"),
  from: z.string().email("Invalid from address").optional(),
  to: z.string().min(1, "Recipient is required"),
});

const appriseUrlConfigSchema = z.object({
  appriseUrl: z.string().min(1, "Apprise URL is required"),
});

const webhookConfigSchema = z.object({
  url: z.string().url("Invalid URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]).optional().default("POST"),
  headers: z.record(z.string()).optional(),
});

const smartRouterConfigSchema = z.object({
  url: z.string().url("Invalid router webhook URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]).optional().default("POST"),
  headers: z.record(z.string()).optional(),
});

export const createChannelSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: channelTypeSchema,
  config: z.record(z.unknown()),
  enabled: z.boolean().optional().default(true),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

// Validate config based on type
export function validateChannelConfig(
  type: string,
  config: Record<string, unknown>
): { success: boolean; error?: string } {
  try {
    switch (type) {
      case "gotify":
        gotifyConfigSchema.parse(config);
        break;
      case "telegram":
        telegramConfigSchema.parse(config);
        break;
      case "discord":
        discordConfigSchema.parse(config);
        break;
      case "slack":
        slackConfigSchema.parse(config);
        break;
      case "email":
        emailConfigSchema.parse(config);
        break;
      case "apprise_url":
        appriseUrlConfigSchema.parse(config);
        break;
      case "webhook":
        webhookConfigSchema.parse(config);
        break;
      case "smart_router":
        smartRouterConfigSchema.parse(config);
        break;
      default:
        return { success: false, error: "Unknown channel type" };
    }
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Invalid config" };
    }
    return { success: false, error: "Invalid config" };
  }
}

export type ChannelType = z.infer<typeof channelTypeSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
