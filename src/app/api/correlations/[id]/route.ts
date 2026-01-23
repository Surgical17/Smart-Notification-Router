import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/correlations/[id] - Get a specific correlation rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const correlation = await prisma.correlationRule.findFirst({
      where: {
        id,
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
        correlationStates: {
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
      },
    });

    if (!correlation) {
      return NextResponse.json(
        { error: "Correlation rule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(correlation);
  } catch (error) {
    console.error("Error fetching correlation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/correlations/[id] - Update a correlation rule
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify the correlation belongs to the user
    const existing = await prisma.correlationRule.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Correlation rule not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.timeWindowMs !== undefined) updateData.timeWindowMs = body.timeWindowMs;

    if (body.actions !== undefined) {
      updateData.actions = JSON.stringify(body.actions);
    }

    if (body.timeoutActions !== undefined) {
      updateData.timeoutActions = body.timeoutActions
        ? JSON.stringify(body.timeoutActions)
        : null;
    }

    // Update webhook IDs if provided
    if (body.sourceWebhookId !== undefined) {
      // Verify webhook belongs to user
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: body.sourceWebhookId,
          userId: session.user.id,
        },
      });

      if (!webhook) {
        return NextResponse.json(
          { error: "Invalid source webhook ID" },
          { status: 400 }
        );
      }

      updateData.sourceWebhookId = body.sourceWebhookId;
    }

    if (body.targetWebhookId !== undefined) {
      // Verify webhook belongs to user
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: body.targetWebhookId,
          userId: session.user.id,
        },
      });

      if (!webhook) {
        return NextResponse.json(
          { error: "Invalid target webhook ID" },
          { status: 400 }
        );
      }

      updateData.targetWebhookId = body.targetWebhookId;
    }

    // Prevent self-correlation
    const finalSourceId = updateData.sourceWebhookId || existing.sourceWebhookId;
    const finalTargetId = updateData.targetWebhookId || existing.targetWebhookId;

    if (finalSourceId === finalTargetId) {
      return NextResponse.json(
        { error: "Source and target webhooks must be different" },
        { status: 400 }
      );
    }

    // Update the correlation
    const updated = await prisma.correlationRule.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating correlation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/correlations/[id] - Delete a correlation rule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the correlation belongs to the user
    const existing = await prisma.correlationRule.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Correlation rule not found" },
        { status: 404 }
      );
    }

    // Delete the correlation (cascade will delete associated states)
    await prisma.correlationRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting correlation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
