import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/correlations/[id]/states - Get correlation states for a rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status"); // waiting, completed, timeout

    // Verify the correlation belongs to the user
    const correlation = await prisma.correlationRule.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!correlation) {
      return NextResponse.json(
        { error: "Correlation rule not found" },
        { status: 404 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = {
      correlationRuleId: id,
    };

    if (status) {
      where.status = status;
    }

    // Get states
    const [states, total] = await Promise.all([
      prisma.correlationState.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.correlationState.count({ where }),
    ]);

    return NextResponse.json({
      states,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching correlation states:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
