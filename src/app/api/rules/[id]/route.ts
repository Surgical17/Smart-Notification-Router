import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateRuleSchema } from "@/lib/validations/webhook";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/rules/[id] - Get a single rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rule = await prisma.rule.findFirst({
      where: {
        id,
        webhook: {
          userId: session.user.id,
        },
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

    return NextResponse.json({
      ...rule,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions),
    });
  } catch (error) {
    console.error("Error fetching rule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/rules/[id] - Update a rule
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existingRule = await prisma.rule.findFirst({
      where: {
        id,
        webhook: {
          userId: session.user.id,
        },
      },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateRuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.conditions !== undefined) updateData.conditions = JSON.stringify(parsed.data.conditions);
    if (parsed.data.actions !== undefined) updateData.actions = JSON.stringify(parsed.data.actions);
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
    if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled;
    if (parsed.data.debounceMs !== undefined) updateData.debounceMs = parsed.data.debounceMs;

    const rule = await prisma.rule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...rule,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions),
    });
  } catch (error) {
    console.error("Error updating rule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/rules/[id] - Delete a rule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existingRule = await prisma.rule.findFirst({
      where: {
        id,
        webhook: {
          userId: session.user.id,
        },
      },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await prisma.rule.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Rule deleted successfully" });
  } catch (error) {
    console.error("Error deleting rule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
