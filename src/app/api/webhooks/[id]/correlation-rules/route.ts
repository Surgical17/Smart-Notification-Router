import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/webhooks/[id]/correlation-rules - List all field correlation rules for a webhook
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify webhook belongs to user
    const webhook = await prisma.webhook.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const rules = await prisma.fieldCorrelationRule.findMany({
      where: { webhookId: id },
      orderBy: { priority: "desc" },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("Error fetching correlation rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch correlation rules" },
      { status: 500 }
    );
  }
}

// POST /api/webhooks/[id]/correlation-rules - Create new field correlation rule
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify webhook belongs to user
    const webhook = await prisma.webhook.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      correlationField,
      expectedValues,
      timeWindowMs,
      matchConditions,
      successActions,
      timeoutActions,
      priority = 0,
      enabled = true,
      debounceMs = 0,
    } = body;

    // Validation
    if (!name || !correlationField || !expectedValues || !timeWindowMs || !matchConditions || !successActions) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Array.isArray(expectedValues) || expectedValues.length < 2) {
      return NextResponse.json(
        { error: "expectedValues must be an array with at least 2 values" },
        { status: 400 }
      );
    }

    const rule = await prisma.fieldCorrelationRule.create({
      data: {
        webhookId: id,
        name,
        correlationField,
        expectedValues: JSON.stringify(expectedValues),
        timeWindowMs,
        matchConditions: JSON.stringify(matchConditions),
        successActions: JSON.stringify(successActions),
        timeoutActions: timeoutActions ? JSON.stringify(timeoutActions) : null,
        priority,
        enabled,
        debounceMs,
        ruleType: "correlation",
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Error creating correlation rule:", error);
    return NextResponse.json(
      { error: "Failed to create correlation rule" },
      { status: 500 }
    );
  }
}
