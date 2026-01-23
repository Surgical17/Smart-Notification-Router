/**
 * Correlation Engine
 *
 * Handles multi-webhook correlation tracking with time windows.
 * Allows triggering actions when multiple webhooks are received within a specified time period.
 */

import { prisma } from "@/lib/prisma";
import { dispatchNotifications } from "./notification-dispatcher";

export interface CorrelationRuleConfig {
  id: string;
  userId: string;
  name: string;
  description?: string;
  enabled: boolean;
  sourceWebhookId: string;
  targetWebhookId: string;
  timeWindowMs: number;
  actions: string; // JSON string
  timeoutActions?: string; // JSON string
}

export interface CorrelationStateRecord {
  id: string;
  correlationRuleId: string;
  sourceWebhookId: string;
  sourcePayload: string;
  sourceReceivedAt: Date;
  targetWebhookId?: string;
  targetPayload?: string;
  targetReceivedAt?: Date;
  status: "waiting" | "completed" | "timeout";
  expiresAt: Date;
  actionTriggered: boolean;
  actionResult?: string;
}

/**
 * Process correlation rules when a webhook is received
 */
export async function processCorrelations(
  webhookId: string,
  payload: Record<string, unknown>,
  userId: string
): Promise<void> {
  // Check if this webhook is a source for any correlation rules
  await processAsSourceWebhook(webhookId, payload, userId);

  // Check if this webhook is a target for any waiting correlations
  await processAsTargetWebhook(webhookId, payload, userId);

  // Clean up expired correlation states
  await cleanupExpiredCorrelations();
}

/**
 * Handle webhook received as a source (initiates correlation tracking)
 */
async function processAsSourceWebhook(
  webhookId: string,
  payload: Record<string, unknown>,
  userId: string
): Promise<void> {
  // Find all enabled correlation rules where this is the source webhook
  const correlationRules = await prisma.correlationRule.findMany({
    where: {
      userId,
      sourceWebhookId: webhookId,
      enabled: true,
    },
  });

  for (const rule of correlationRules) {
    // Create a new correlation state to track this sequence
    const expiresAt = new Date(Date.now() + rule.timeWindowMs);

    await prisma.correlationState.create({
      data: {
        correlationRuleId: rule.id,
        sourceWebhookId: webhookId,
        sourcePayload: JSON.stringify(payload),
        sourceReceivedAt: new Date(),
        expiresAt,
        status: "waiting",
        actionTriggered: false,
      },
    });
  }
}

/**
 * Handle webhook received as a target (completes correlation tracking)
 */
async function processAsTargetWebhook(
  webhookId: string,
  payload: Record<string, unknown>,
  userId: string
): Promise<void> {
  // Find all enabled correlation rules where this is the target webhook
  const correlationRules = await prisma.correlationRule.findMany({
    where: {
      userId,
      targetWebhookId: webhookId,
      enabled: true,
    },
    include: {
      correlationStates: {
        where: {
          status: "waiting",
          expiresAt: {
            gt: new Date(), // Not expired yet
          },
        },
      },
    },
  });

  for (const rule of correlationRules) {
    // Find waiting correlation states for this rule
    for (const state of rule.correlationStates) {
      // Complete the correlation
      await completeCorrelation(state.id, webhookId, payload, rule);
    }
  }
}

/**
 * Complete a correlation when both webhooks have been received
 */
async function completeCorrelation(
  stateId: string,
  targetWebhookId: string,
  targetPayload: Record<string, unknown>,
  rule: CorrelationRuleConfig & { correlationStates: CorrelationStateRecord[] }
): Promise<void> {
  // Update the correlation state
  const state = await prisma.correlationState.update({
    where: { id: stateId },
    data: {
      targetWebhookId,
      targetPayload: JSON.stringify(targetPayload),
      targetReceivedAt: new Date(),
      status: "completed",
    },
  });

  // Parse the source payload for context
  const sourcePayload = JSON.parse(state.sourcePayload);

  // Create a combined payload for action processing
  const combinedPayload = {
    source: sourcePayload,
    target: targetPayload,
    _correlation: {
      ruleId: rule.id,
      ruleName: rule.name,
      sourceReceivedAt: state.sourceReceivedAt.toISOString(),
      targetReceivedAt: new Date().toISOString(),
      timeElapsed: Date.now() - state.sourceReceivedAt.getTime(),
    },
  };

  // Trigger the correlation actions
  try {
    const actions = JSON.parse(rule.actions);
    const results = await dispatchNotifications(actions, combinedPayload);

    // Update the state with action results
    await prisma.correlationState.update({
      where: { id: stateId },
      data: {
        actionTriggered: true,
        actionResult: JSON.stringify(results),
      },
    });
  } catch (error) {
    console.error("Error dispatching correlation actions:", error);
    await prisma.correlationState.update({
      where: { id: stateId },
      data: {
        actionTriggered: false,
        actionResult: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      },
    });
  }
}

/**
 * Clean up expired correlation states and trigger timeout actions if configured
 */
async function cleanupExpiredCorrelations(): Promise<void> {
  const now = new Date();

  // Find all expired waiting correlations
  const expiredStates = await prisma.correlationState.findMany({
    where: {
      status: "waiting",
      expiresAt: {
        lte: now,
      },
    },
    include: {
      correlationRule: true,
    },
  });

  for (const state of expiredStates) {
    // Mark as timeout
    await prisma.correlationState.update({
      where: { id: state.id },
      data: {
        status: "timeout",
      },
    });

    // Check if timeout actions are configured
    if (state.correlationRule.timeoutActions) {
      const sourcePayload = JSON.parse(state.sourcePayload);

      const timeoutPayload = {
        source: sourcePayload,
        _correlation: {
          ruleId: state.correlationRule.id,
          ruleName: state.correlationRule.name,
          sourceReceivedAt: state.sourceReceivedAt.toISOString(),
          timeoutAt: now.toISOString(),
          expectedTargetWebhookId: state.correlationRule.targetWebhookId,
        },
      };

      try {
        const timeoutActions = JSON.parse(state.correlationRule.timeoutActions);
        const results = await dispatchNotifications(
          timeoutActions,
          timeoutPayload
        );

        await prisma.correlationState.update({
          where: { id: state.id },
          data: {
            actionTriggered: true,
            actionResult: JSON.stringify(results),
          },
        });
      } catch (error) {
        console.error("Error dispatching timeout actions:", error);
      }
    }
  }
}

/**
 * Get correlation statistics for a webhook
 */
export async function getCorrelationStats(webhookId: string) {
  const asSource = await prisma.correlationState.groupBy({
    by: ["status"],
    where: {
      sourceWebhookId: webhookId,
    },
    _count: true,
  });

  const asTarget = await prisma.correlationState.groupBy({
    by: ["status"],
    where: {
      targetWebhookId: webhookId,
    },
    _count: true,
  });

  return {
    asSource: asSource.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>
    ),
    asTarget: asTarget.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>
    ),
  };
}
