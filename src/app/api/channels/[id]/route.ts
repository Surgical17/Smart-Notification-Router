import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateChannelSchema, validateChannelConfig } from "@/lib/validations/channel";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/channels/[id] - Get a single channel
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const channel = await prisma.notificationChannel.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Parse config but mask sensitive fields
    const config = JSON.parse(channel.config);
    const maskedConfig = maskSensitiveFields(channel.type, config);

    return NextResponse.json({
      ...channel,
      config: maskedConfig,
    });
  } catch (error) {
    console.error("Error fetching channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/channels/[id] - Update a channel
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existingChannel = await prisma.notificationChannel.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingChannel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateChannelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }

    if (parsed.data.enabled !== undefined) {
      updateData.enabled = parsed.data.enabled;
    }

    if (parsed.data.config !== undefined) {
      // Merge with existing config (to allow partial updates)
      const existingConfig = JSON.parse(existingChannel.config);
      const newConfig = { ...existingConfig, ...parsed.data.config };

      // Validate the merged config
      const configValidation = validateChannelConfig(
        existingChannel.type,
        newConfig as Record<string, unknown>
      );

      if (!configValidation.success) {
        return NextResponse.json(
          { error: configValidation.error },
          { status: 400 }
        );
      }

      updateData.config = JSON.stringify(newConfig);
    }

    const channel = await prisma.notificationChannel.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
        createdAt: true,
      },
    });

    return NextResponse.json(channel);
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/[id] - Delete a channel
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existingChannel = await prisma.notificationChannel.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingChannel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await prisma.notificationChannel.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Channel deleted successfully" });
  } catch (error) {
    console.error("Error deleting channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper to mask sensitive config fields
function maskSensitiveFields(
  type: string,
  config: Record<string, unknown>
): Record<string, unknown> {
  const masked = { ...config };
  const sensitiveFields: Record<string, string[]> = {
    gotify: ["token"],
    telegram: ["botToken"],
    email: ["pass"],
    webhook: [],
    discord: [],
    slack: [],
    apprise_url: [],
  };

  const fields = sensitiveFields[type] || [];
  for (const field of fields) {
    if (masked[field]) {
      masked[field] = "••••••••";
    }
  }

  return masked;
}
