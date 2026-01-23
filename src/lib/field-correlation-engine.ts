/**
 * Field Correlation Engine
 *
 * Handles field-based correlation within a single webhook.
 * Waits for multiple notifications with different field values within a time window.
 */

import { prisma } from "@/lib/prisma";
import { evaluateConditionGroup } from "./rule-engine";
import { dispatchNotifications } from "./notification-dispatcher";

/**
 * Process field correlations when a webhook receives data
 */
export async function processFieldCorrelations(
  webhookId: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Get all enabled field correlation rules for this webhook
  const rules = await prisma.fieldCorrelationRule.findMany({
    where: {
      webhookId,
      enabled: true,
    },
    orderBy: {
      priority: "desc",
    },
  });

  for (const rule of rules) {
    try {
      // Check if match conditions pass
      const matchConditions = JSON.parse(rule.matchConditions);
      const conditionsMatch = await evaluateConditionGroup(matchConditions, payload);

      if (!conditionsMatch) {
        continue; // This rule doesn't apply to this payload
      }

      // Extract the correlation field value
      const fieldValue = getNestedValue(payload, rule.correlationField);
      if (!fieldValue) {
        console.log(`Correlation field ${rule.correlationField} not found in payload`);
        continue;
      }

      const fieldValueStr = String(fieldValue);
      const expectedValues: string[] = JSON.parse(rule.expectedValues);

      // Check if this field value is one we're expecting
      if (!expectedValues.includes(fieldValueStr)) {
        console.log(`Field value "${fieldValueStr}" not in expected values`);
        continue;
      }

      // Check debounce
      if (rule.debounceMs > 0 && rule.lastTriggered) {
        const timeSinceLastTriggered = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTriggered < rule.debounceMs) {
          console.log(`Rule ${rule.id} is debounced`);
          continue;
        }
      }

      // Find or create correlation state
      await processCorrelationValue(rule, fieldValueStr, payload, expectedValues);
    } catch (error) {
      console.error(`Error processing field correlation rule ${rule.id}:`, error);
    }
  }

  // Clean up expired states
  await cleanupExpiredStates();
}

/**
 * Process a received value for a correlation rule
 */
async function processCorrelationValue(
  rule: any,
  fieldValue: string,
  payload: Record<string, unknown>,
  expectedValues: string[]
): Promise<void> {
  // Find waiting correlation state for this rule
  const existingState = await prisma.fieldCorrelationState.findFirst({
    where: {
      ruleId: rule.id,
      status: "waiting",
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (existingState) {
    // Update existing state
    const receivedValues = JSON.parse(existingState.receivedValues);
    const pendingValues: string[] = JSON.parse(existingState.pendingValues);

    // Check if we already received this value
    if (receivedValues[fieldValue]) {
      console.log(`Already received value "${fieldValue}" for rule ${rule.id}`);
      return;
    }

    // Add this value
    receivedValues[fieldValue] = payload;
    const newPendingValues = pendingValues.filter((v) => v !== fieldValue);

    // Update state
    await prisma.fieldCorrelationState.update({
      where: { id: existingState.id },
      data: {
        receivedValues: JSON.stringify(receivedValues),
        pendingValues: JSON.stringify(newPendingValues),
      },
    });

    // Check if all values received
    if (newPendingValues.length === 0) {
      await completeCorrelation(existingState.id, rule, receivedValues);
    }
  } else {
    // Create new correlation state
    const receivedValues: Record<string, any> = {
      [fieldValue]: payload,
    };
    const pendingValues = expectedValues.filter((v) => v !== fieldValue);

    const expiresAt = new Date(Date.now() + rule.timeWindowMs);

    const newState = await prisma.fieldCorrelationState.create({
      data: {
        ruleId: rule.id,
        receivedValues: JSON.stringify(receivedValues),
        pendingValues: JSON.stringify(pendingValues),
        expiresAt,
        status: "waiting",
        actionTriggered: false,
      },
    });

    // Check if all values received (in case only one value expected)
    if (pendingValues.length === 0) {
      await completeCorrelation(newState.id, rule, receivedValues);
    }
  }
}

/**
 * Complete a correlation when all values have been received
 */
async function completeCorrelation(
  stateId: string,
  rule: any,
  receivedValues: Record<string, any>
): Promise<void> {
  const state = await prisma.fieldCorrelationState.findUnique({
    where: { id: stateId },
  });

  if (!state || state.actionTriggered) {
    return; // Already processed
  }

  // Update state to completed
  await prisma.fieldCorrelationState.update({
    where: { id: stateId },
    data: {
      status: "completed",
    },
  });

  // Build combined payload with correlation metadata
  const sources = Object.keys(receivedValues);
  const combinedPayload = {
    ...receivedValues[sources[0]], // Use first payload as base
    _correlation: {
      field: rule.correlationField,
      sources,
      received: sources,
      missing: [],
      timeElapsed: Date.now() - state.firstReceivedAt.getTime(),
      payloads: receivedValues,
    },
  };

  // Trigger success action
  try {
    const successActions = JSON.parse(rule.successActions);
    const results = await dispatchNotifications(successActions, combinedPayload);

    await prisma.fieldCorrelationState.update({
      where: { id: stateId },
      data: {
        actionTriggered: true,
        actionResult: JSON.stringify(results),
      },
    });

    // Update rule last triggered
    await prisma.fieldCorrelationRule.update({
      where: { id: rule.id },
      data: {
        lastTriggered: new Date(),
      },
    });
  } catch (error) {
    console.error("Error triggering correlation success action:", error);
    await prisma.fieldCorrelationState.update({
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
 * Clean up expired correlation states and trigger timeout actions
 */
async function cleanupExpiredStates(): Promise<void> {
  const now = new Date();

  const expiredStates = await prisma.fieldCorrelationState.findMany({
    where: {
      status: "waiting",
      expiresAt: {
        lte: now,
      },
    },
    include: {
      rule: true,
    },
  });

  for (const state of expiredStates) {
    // Mark as timeout
    await prisma.fieldCorrelationState.update({
      where: { id: state.id },
      data: {
        status: "timeout",
      },
    });

    // Trigger timeout action if configured
    if (state.rule.timeoutActions) {
      const receivedValues = JSON.parse(state.receivedValues);
      const pendingValues: string[] = JSON.parse(state.pendingValues);
      const sources = Object.keys(receivedValues);
      const expectedValues: string[] = JSON.parse(state.rule.expectedValues);

      const timeoutPayload = {
        ...receivedValues[sources[0]], // Use first payload as base
        _correlation: {
          field: state.rule.correlationField,
          sources: expectedValues,
          received: sources,
          missing: pendingValues,
          timeElapsed: now.getTime() - state.firstReceivedAt.getTime(),
          payloads: receivedValues,
        },
      };

      try {
        const timeoutActions = JSON.parse(state.rule.timeoutActions);
        const results = await dispatchNotifications(timeoutActions, timeoutPayload);

        await prisma.fieldCorrelationState.update({
          where: { id: state.id },
          data: {
            actionTriggered: true,
            actionResult: JSON.stringify(results),
          },
        });
      } catch (error) {
        console.error("Error triggering correlation timeout action:", error);
      }
    }
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}
