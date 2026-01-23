import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/correlations - Get all correlation rules for current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const correlations = await prisma.correlationRule.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        sourceWebhook: {
          select: {
            id: true,
            name: true,
            uniqueUrl: true,
          },
        },
        targetWebhook: {
          select: {
            id: true,
            name: true,
            uniqueUrl: true,
          },
        },
        _count: {
          select: {
            correlationStates: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(correlations);
  } catch (error) {
    console.error("Error fetching correlations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/correlations - Create a new correlation rule
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      sourceWebhookId,
      targetWebhookId,
      timeWindowMs,
      actions,
      timeoutActions,
      enabled,
    } = body;

    // Validate required fields
    if (!name || !sourceWebhookId || !targetWebhookId || !actions) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify both webhooks belong to the user
    const webhooks = await prisma.webhook.findMany({
      where: {
        id: { in: [sourceWebhookId, targetWebhookId] },
        userId: session.user.id,
      },
    });

    if (webhooks.length !== 2) {
      return NextResponse.json(
        { error: "Invalid webhook IDs" },
        { status: 400 }
      );
    }

    // Prevent self-correlation
    if (sourceWebhookId === targetWebhookId) {
      return NextResponse.json(
        { error: "Source and target webhooks must be different" },
        { status: 400 }
      );
    }

    // Create the correlation rule
    const correlation = await prisma.correlationRule.create({
      data: {
        userId: session.user.id,
        name,
        description,
        sourceWebhookId,
        targetWebhookId,
        timeWindowMs: timeWindowMs || 300000, // Default 5 minutes
        actions: JSON.stringify(actions),
        timeoutActions: timeoutActions ? JSON.stringify(timeoutActions) : null,
        enabled: enabled !== undefined ? enabled : true,
      },
      include: {
        sourceWebhook: {
          select: {
            id: true,
            name: true,
            uniqueUrl: true,
          },
        },
        targetWebhook: {
          select: {
            id: true,
            name: true,
            uniqueUrl: true,
          },
        },
      },
    });

    return NextResponse.json(correlation, { status: 201 });
  } catch (error) {
    console.error("Error creating correlation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
