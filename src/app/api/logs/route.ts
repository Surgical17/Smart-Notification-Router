import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/logs - Get all logs for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const status = searchParams.get("status");
    const webhookId = searchParams.get("webhookId");

    // Build where clause
    const where: Record<string, unknown> = {
      webhook: {
        userId: session.user.id,
      },
    };

    if (status) {
      where.status = status;
    }

    if (webhookId) {
      where.webhookId = webhookId;
    }

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: Math.min(limit, 100),
        skip: offset,
        include: {
          webhook: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.webhookLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
