import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateRule, isRuleDebounced, updateRuleLastTriggered, updateServerState } from "@/lib/rule-engine";
import { dispatchNotifications, NotificationResult } from "@/lib/notification-dispatcher";
import { processCorrelations } from "@/lib/correlation-engine";
import { processFieldCorrelations } from "@/lib/field-correlation-engine";
import { ConditionGroup, RuleAction } from "@/lib/validations/webhook";

interface RouteParams {
  params: Promise<{ uniqueUrl: string }>;
}

// POST /api/webhook/[uniqueUrl] - Receive webhook payload
export async function POST(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  const { uniqueUrl } = await params;

  try {
    // Find the webhook by unique URL
    const webhook = await prisma.webhook.findUnique({
      where: { uniqueUrl },
      include: {
        rules: {
          where: { enabled: true },
          orderBy: { priority: "desc" },
        },
        user: {
          select: { id: true },
        },
      },
    });

    if (!webhook) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404 }
      );
    }

    if (!webhook.enabled) {
      return NextResponse.json(
        { error: "Webhook is disabled" },
        { status: 403 }
      );
    }

    // Parse the payload
    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    // Add metadata to payload
    payload._metadata = {
      webhookId: webhook.id,
      webhookName: webhook.name,
      receivedAt: new Date().toISOString(),
      sourceIp: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    };

    // Check for server state updates (common pattern in monitoring webhooks)
    if (payload.server || payload.serverName || payload.host) {
      const serverName = String(payload.server || payload.serverName || payload.host);
      const monitorStatus = (payload.monitor as any)?.status;
      const isOnline = payload.status === "up" ||
                       payload.status === "online" ||
                       payload.state === "up" ||
                       payload.state === "online" ||
                       monitorStatus === 1;

      await updateServerState(serverName, isOnline, payload as Record<string, unknown>);
    }

    // Process field correlations (runs asynchronously, doesn't block immediate rules)
    processFieldCorrelations(webhook.id, payload).catch((error) => {
      console.error("Error processing field correlations:", error);
    });

    let ruleTriggered: string | null = null;
    let notificationSent = false;
    let status = "no_match";
    let errorMessage: string | null = null;
    const triggeredRules: string[] = [];

    // Get match mode from webhook (default to first_match for backwards compatibility)
    const matchMode = webhook.matchMode || "first_match";

    // Evaluate rules in priority order
    for (const rule of webhook.rules) {
      try {
        const conditions = JSON.parse(rule.conditions) as ConditionGroup;
        const ruleMatches = await evaluateRule(conditions, payload);

        if (ruleMatches) {
          // Check debounce
          const isDebounced = await isRuleDebounced(rule.id, rule.debounceMs);
          if (isDebounced) {
            // In all_matches mode, skip this rule but continue checking others
            if (matchMode === "all_matches") {
              continue;
            }
            // In first_match mode, stop here
            status = "skipped";
            errorMessage = "Rule debounced";
            ruleTriggered = rule.id;
            break;
          }

          // Parse actions and dispatch notifications
          const actions = JSON.parse(rule.actions) as RuleAction;
          const results = await dispatchNotifications(actions, payload);

          // Update last triggered time
          await updateRuleLastTriggered(rule.id);

          // Track this triggered rule
          triggeredRules.push(rule.id);

          // Check results
          const successfulNotifications = results.filter((r: NotificationResult) => r.success);
          const ruleNotificationSent = successfulNotifications.length > 0;

          if (ruleNotificationSent) {
            notificationSent = true;
            if (status !== "failed") {
              status = "success";
            }
          } else {
            status = "failed";
            const ruleErrors = results.map((r: NotificationResult) => r.error).filter(Boolean).join("; ");
            errorMessage = errorMessage ? `${errorMessage}; ${ruleErrors}` : ruleErrors;
          }

          // In first_match mode, stop after first matching rule
          if (matchMode === "first_match") {
            ruleTriggered = rule.id;
            break;
          }
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
        status = "failed";
        const ruleError = error instanceof Error ? error.message : "Rule evaluation error";
        errorMessage = errorMessage ? `${errorMessage}; ${ruleError}` : ruleError;

        // In first_match mode, stop on error
        if (matchMode === "first_match") {
          ruleTriggered = rule.id;
          break;
        }
      }
    }

    // Set ruleTriggered based on match mode
    if (matchMode === "all_matches" && triggeredRules.length > 0) {
      ruleTriggered = triggeredRules.join(",");
    }

    // Process correlation rules (runs asynchronously, doesn't block response)
    processCorrelations(webhook.id, payload, webhook.user.id).catch((error) => {
      console.error("Error processing correlations:", error);
    });

    // Log the webhook
    const responseTime = Date.now() - startTime;
    await prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        payload: JSON.stringify(payload),
        ruleTriggered,
        notificationSent,
        status,
        errorMessage,
        responseTime,
      },
    });

    return NextResponse.json({
      success: true,
      status,
      ruleTriggered,
      notificationSent,
      responseTime,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    // Try to log the error
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { uniqueUrl },
      });

      if (webhook) {
        await prisma.webhookLog.create({
          data: {
            webhookId: webhook.id,
            payload: JSON.stringify({ error: "Failed to parse payload" }),
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            responseTime: Date.now() - startTime,
          },
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/webhook/[uniqueUrl] - Health check for webhook
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { uniqueUrl } = await params;

  const webhook = await prisma.webhook.findUnique({
    where: { uniqueUrl },
    select: {
      id: true,
      name: true,
      enabled: true,
    },
  });

  if (!webhook) {
    return NextResponse.json(
      { error: "Webhook not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    name: webhook.name,
    enabled: webhook.enabled,
    status: webhook.enabled ? "active" : "disabled",
  });
}
