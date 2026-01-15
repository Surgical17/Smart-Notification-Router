import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateRule, isRuleDebounced, updateRuleLastTriggered, updateServerState } from "@/lib/rule-engine";
import { dispatchNotifications } from "@/lib/notification-dispatcher";
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
      const isOnline = payload.status === "up" ||
                       payload.status === "online" ||
                       payload.state === "up" ||
                       payload.state === "online" ||
                       payload.monitor?.status === 1;

      await updateServerState(serverName, isOnline, payload as Record<string, unknown>);
    }

    let ruleTriggered: string | null = null;
    let notificationSent = false;
    let status = "no_match";
    let errorMessage: string | null = null;

    // Evaluate rules in priority order
    for (const rule of webhook.rules) {
      try {
        const conditions = JSON.parse(rule.conditions) as ConditionGroup;
        const ruleMatches = await evaluateRule(conditions, payload);

        if (ruleMatches) {
          ruleTriggered = rule.id;

          // Check debounce
          const isDebounced = await isRuleDebounced(rule.id, rule.debounceMs);
          if (isDebounced) {
            status = "skipped";
            errorMessage = "Rule debounced";
            break;
          }

          // Parse actions and dispatch notifications
          const actions = JSON.parse(rule.actions) as RuleAction;
          const results = await dispatchNotifications(actions, payload);

          // Update last triggered time
          await updateRuleLastTriggered(rule.id);

          // Check results
          const successfulNotifications = results.filter((r) => r.success);
          notificationSent = successfulNotifications.length > 0;

          if (notificationSent) {
            status = "success";
          } else {
            status = "failed";
            errorMessage = results.map((r) => r.error).filter(Boolean).join("; ");
          }

          // Stop after first matching rule
          break;
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
        status = "failed";
        errorMessage = error instanceof Error ? error.message : "Rule evaluation error";
      }
    }

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
