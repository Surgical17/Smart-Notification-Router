import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/webhooks/[id]/logs - Get logs for a webhook
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

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { webhookId };
    if (status) {
      where.status = status;
    }

    const logs = await prisma.webhookLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
