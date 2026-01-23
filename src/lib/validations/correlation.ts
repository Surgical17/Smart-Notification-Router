import { z } from "zod";
import { actionSchema } from "./webhook";

export const createCorrelationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  enabled: z.boolean().optional().default(true),
  sourceWebhookId: z.string().min(1, "Source webhook is required"),
  targetWebhookId: z.string().min(1, "Target webhook is required"),
  timeWindowMs: z.number().int().min(1000).max(86400000).optional().default(300000), // 1 second to 24 hours, default 5 minutes
  actions: actionSchema,
  timeoutActions: actionSchema.optional().nullable(),
}).refine(
  (data) => data.sourceWebhookId !== data.targetWebhookId,
  {
    message: "Source and target webhooks must be different",
    path: ["targetWebhookId"],
  }
);

export const updateCorrelationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  enabled: z.boolean().optional(),
  sourceWebhookId: z.string().min(1).optional(),
  targetWebhookId: z.string().min(1).optional(),
  timeWindowMs: z.number().int().min(1000).max(86400000).optional(),
  actions: actionSchema.optional(),
  timeoutActions: actionSchema.optional().nullable(),
});

// Types
export type CreateCorrelationInput = z.infer<typeof createCorrelationSchema>;
export type UpdateCorrelationInput = z.infer<typeof updateCorrelationSchema>;
