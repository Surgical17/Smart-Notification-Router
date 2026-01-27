import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Recursively extract all dot-notation field paths from an object
function extractFieldPaths(
  obj: unknown,
  prefix: string = "",
  paths: { path: string; value: unknown; type: string }[] = []
): { path: string; value: unknown; type: string }[] {
  if (obj === null || obj === undefined) return paths;

  if (Array.isArray(obj)) {
    // Show array itself and sample first element's fields
    if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
      extractFieldPaths(obj[0], `${prefix}.0`, paths);
    }
    return paths;
  }

  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;

      if (value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value)) {
        // Add the object itself as a path (useful for is_empty/is_not_empty)
        paths.push({ path: fullPath, value: "{object}", type: "object" });
        // Recurse into nested objects
        extractFieldPaths(value, fullPath, paths);
      } else if (Array.isArray(value)) {
        paths.push({ path: fullPath, value: `[${value.length} items]`, type: "array" });
        // Recurse into first array element if it's an object
        if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
          extractFieldPaths(value[0], `${fullPath}.0`, paths);
        }
      } else {
        paths.push({
          path: fullPath,
          value: value,
          type: typeof value,
        });
      }
    }
  }

  return paths;
}

// GET /api/webhooks/[id]/payload-fields - Get field paths from recent payloads
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

    // Get the most recent log with a payload
    const recentLog = await prisma.webhookLog.findFirst({
      where: { webhookId },
      orderBy: { timestamp: "desc" },
      select: { payload: true, timestamp: true },
    });

    if (!recentLog?.payload) {
      return NextResponse.json({
        fields: [],
        message: "No payloads received yet. Send a test webhook to see available fields.",
      });
    }

    try {
      const payload = JSON.parse(recentLog.payload);
      const fields = extractFieldPaths(payload);

      return NextResponse.json({
        fields,
        receivedAt: recentLog.timestamp,
      });
    } catch {
      return NextResponse.json({
        fields: [],
        message: "Could not parse most recent payload.",
      });
    }
  } catch (error) {
    console.error("Error fetching payload fields:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
