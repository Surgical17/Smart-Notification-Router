import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createChannelSchema, validateChannelConfig } from "@/lib/validations/channel";

// GET /api/channels - List all channels for the authenticated user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const channels = await prisma.notificationChannel.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
        createdAt: true,
        // Don't expose full config (contains secrets)
      },
    });

    return NextResponse.json(channels);
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/channels - Create a new channel
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createChannelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Validate type-specific config
    const configValidation = validateChannelConfig(
      parsed.data.type,
      parsed.data.config as Record<string, unknown>
    );

    if (!configValidation.success) {
      return NextResponse.json(
        { error: configValidation.error },
        { status: 400 }
      );
    }

    const channel = await prisma.notificationChannel.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        type: parsed.data.type,
        config: JSON.stringify(parsed.data.config),
        enabled: parsed.data.enabled,
      },
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
        createdAt: true,
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
