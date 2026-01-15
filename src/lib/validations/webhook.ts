import { z } from "zod";

export const createWebhookSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  enabled: z.boolean().optional().default(true),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters").optional(),
  description: z.string().max(500, "Description must be less than 500 characters").optional().nullable(),
  enabled: z.boolean().optional(),
});

// Condition operators for rule evaluation
export const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
  "is_empty",
  "is_not_empty",
  "is_true",
  "is_false",
  "regex_match",
  // Server state operators
  "server_is_online",
  "server_is_offline",
]);

export const conditionSchema = z.object({
  field: z.string().min(1, "Field is required"),
  operator: conditionOperatorSchema,
  value: z.any().optional(),
});

export const conditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.object({
    logic: z.enum(["AND", "OR"]),
    conditions: z.array(z.union([conditionSchema, conditionGroupSchema])),
  })
);

export const actionSchema = z.object({
  channelIds: z.array(z.string()).min(1, "At least one channel is required"),
  messageTemplate: z.string().min(1, "Message template is required"),
  titleTemplate: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
});

export const createRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  conditions: conditionGroupSchema,
  actions: actionSchema,
  priority: z.number().int().min(0).max(100).optional().default(0),
  enabled: z.boolean().optional().default(true),
  debounceMs: z.number().int().min(0).max(86400000).optional().default(0), // Max 24 hours
});

export const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  conditions: conditionGroupSchema.optional(),
  actions: actionSchema.optional(),
  priority: z.number().int().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
  debounceMs: z.number().int().min(0).max(86400000).optional(),
});

// Types
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  logic: "AND" | "OR";
  conditions: (Condition | ConditionGroup)[];
}

export interface RuleAction {
  channelIds: string[];
  messageTemplate: string;
  titleTemplate?: string;
  priority: "low" | "normal" | "high" | "urgent";
}

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
