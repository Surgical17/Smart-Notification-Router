import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRuleSchema } from "@/lib/validations/webhook";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/webhooks/[id]/rules - List all rules for a webhook
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id: webhookId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify webhook ownership
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        userId: session.user.id,
      },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const rules = await prisma.rule.findMany({
      where: { webhookId },
      orderBy: { priority: "desc" },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("Error fetching rules:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/webhooks/[id]/rules - Create a new rule
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id: webhookId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify webhook ownership
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        userId: session.user.id,
      },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createRuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rule = await prisma.rule.create({
      data: {
        webhookId,
        name: parsed.data.name,
        conditions: JSON.stringify(parsed.data.conditions),
        actions: JSON.stringify(parsed.data.actions),
        priority: parsed.data.priority,
        enabled: parsed.data.enabled,
        debounceMs: parsed.data.debounceMs,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Error creating rule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
