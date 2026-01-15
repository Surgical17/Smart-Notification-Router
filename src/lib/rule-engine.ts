import { prisma } from "@/lib/prisma";
import { Condition, ConditionGroup, ConditionOperator } from "@/lib/validations/webhook";

// Get a value from a nested object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let value: unknown = obj;

  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[key];
  }

  return value;
}

// Evaluate a single condition against a payload
async function evaluateCondition(
  condition: Condition,
  payload: Record<string, unknown>
): Promise<boolean> {
  const { field, operator, value } = condition;

  // Handle server state operators
  if (operator === "server_is_online" || operator === "server_is_offline") {
    const serverName = String(field);
    const serverState = await prisma.serverState.findUnique({
      where: { serverName },
    });

    if (!serverState) {
      // Server not tracked yet, assume offline
      return operator === "server_is_offline";
    }

    return operator === "server_is_online" ? serverState.isOnline : !serverState.isOnline;
  }

  // Get the field value from payload
  const fieldValue = getNestedValue(payload, field);

  switch (operator) {
    case "equals":
      return fieldValue === value;

    case "not_equals":
      return fieldValue !== value;

    case "contains":
      if (typeof fieldValue === "string" && typeof value === "string") {
        return fieldValue.toLowerCase().includes(value.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(value);
      }
      return false;

    case "not_contains":
      if (typeof fieldValue === "string" && typeof value === "string") {
        return !fieldValue.toLowerCase().includes(value.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(value);
      }
      return true;

    case "starts_with":
      if (typeof fieldValue === "string" && typeof value === "string") {
        return fieldValue.toLowerCase().startsWith(value.toLowerCase());
      }
      return false;

    case "ends_with":
      if (typeof fieldValue === "string" && typeof value === "string") {
        return fieldValue.toLowerCase().endsWith(value.toLowerCase());
      }
      return false;

    case "greater_than":
      return typeof fieldValue === "number" && typeof value === "number" && fieldValue > value;

    case "less_than":
      return typeof fieldValue === "number" && typeof value === "number" && fieldValue < value;

    case "greater_than_or_equal":
      return typeof fieldValue === "number" && typeof value === "number" && fieldValue >= value;

    case "less_than_or_equal":
      return typeof fieldValue === "number" && typeof value === "number" && fieldValue <= value;

    case "is_empty":
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === "" ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case "is_not_empty":
      return (
        fieldValue !== null &&
        fieldValue !== undefined &&
        fieldValue !== "" &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case "is_true":
      return fieldValue === true || fieldValue === "true" || fieldValue === 1;

    case "is_false":
      return fieldValue === false || fieldValue === "false" || fieldValue === 0;

    case "regex_match":
      if (typeof fieldValue === "string" && typeof value === "string") {
        try {
          const regex = new RegExp(value, "i");
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      }
      return false;

    default:
      return false;
  }
}

// Check if a condition is a group (has logic and conditions array)
function isConditionGroup(item: Condition | ConditionGroup): item is ConditionGroup {
  return "logic" in item && "conditions" in item;
}

// Evaluate a condition group (recursive)
async function evaluateConditionGroup(
  group: ConditionGroup,
  payload: Record<string, unknown>
): Promise<boolean> {
  const results = await Promise.all(
    group.conditions.map(async (item) => {
      if (isConditionGroup(item)) {
        return evaluateConditionGroup(item, payload);
      }
      return evaluateCondition(item, payload);
    })
  );

  if (group.logic === "AND") {
    return results.every((r) => r === true);
  }

  // OR logic
  return results.some((r) => r === true);
}

// Main function to evaluate a rule against a payload
export async function evaluateRule(
  conditions: ConditionGroup,
  payload: Record<string, unknown>
): Promise<boolean> {
  return evaluateConditionGroup(conditions, payload);
}

// Check if a rule is within its debounce period
export async function isRuleDebounced(ruleId: string, debounceMs: number): Promise<boolean> {
  if (debounceMs <= 0) return false;

  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    select: { lastTriggered: true },
  });

  if (!rule?.lastTriggered) return false;

  const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
  return timeSinceLastTrigger < debounceMs;
}

// Update the last triggered time for a rule
export async function updateRuleLastTriggered(ruleId: string): Promise<void> {
  await prisma.rule.update({
    where: { id: ruleId },
    data: { lastTriggered: new Date() },
  });
}

// Update server state based on webhook payload
export async function updateServerState(
  serverName: string,
  isOnline: boolean,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.serverState.upsert({
    where: { serverName },
    update: {
      isOnline,
      lastSeen: new Date(),
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
    create: {
      serverName,
      isOnline,
      lastSeen: new Date(),
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  });
}

// Template processing: replace {{variable}} with values from payload
export function processTemplate(
  template: string,
  payload: Record<string, unknown>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(payload, path.trim());
    if (value === undefined || value === null) return match;
    return String(value);
  });
}
