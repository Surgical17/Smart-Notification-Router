import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/correlation-rules/[id] - Get single field correlation rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const rule = await prisma.fieldCorrelationRule.findFirst({
      where: {
        id,
        webhook: { userId: session.user.id },
      },
      include: {
        webhook: {
          select: { id: true, name: true },
        },
      },
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error fetching correlation rule:", error);
    return NextResponse.json(
      { error: "Failed to fetch correlation rule" },
      { status: 500 }
    );
  }
}

// PATCH /api/correlation-rules/[id] - Update field correlation rule
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify rule belongs to user's webhook
    const existingRule = await prisma.fieldCorrelationRule.findFirst({
      where: {
        id,
        webhook: { userId: session.user.id },
      },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
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
      priority,
      enabled,
      debounceMs,
    } = body;

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (correlationField !== undefined) updateData.correlationField = correlationField;
    if (expectedValues !== undefined) {
      if (!Array.isArray(expectedValues) || expectedValues.length < 2) {
        return NextResponse.json(
          { error: "expectedValues must be an array with at least 2 values" },
          { status: 400 }
        );
      }
      updateData.expectedValues = JSON.stringify(expectedValues);
    }
    if (timeWindowMs !== undefined) updateData.timeWindowMs = timeWindowMs;
    if (matchConditions !== undefined) updateData.matchConditions = JSON.stringify(matchConditions);
    if (successActions !== undefined) updateData.successActions = JSON.stringify(successActions);
    if (timeoutActions !== undefined) {
      updateData.timeoutActions = timeoutActions ? JSON.stringify(timeoutActions) : null;
    }
    if (priority !== undefined) updateData.priority = priority;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (debounceMs !== undefined) updateData.debounceMs = debounceMs;

    const updatedRule = await prisma.fieldCorrelationRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error("Error updating correlation rule:", error);
    return NextResponse.json(
      { error: "Failed to update correlation rule" },
      { status: 500 }
    );
  }
}

// DELETE /api/correlation-rules/[id] - Delete field correlation rule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify rule belongs to user's webhook
    const existingRule = await prisma.fieldCorrelationRule.findFirst({
      where: {
        id,
        webhook: { userId: session.user.id },
      },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await prisma.fieldCorrelationRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting correlation rule:", error);
    return NextResponse.json(
      { error: "Failed to delete correlation rule" },
      { status: 500 }
    );
  }
}
