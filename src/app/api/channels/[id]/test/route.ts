import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testNotificationChannel } from "@/lib/notification-dispatcher";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/channels/[id]/test - Test a notification channel
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await testNotificationChannel(id, session.user.id);

    if (result.success) {
      return NextResponse.json({ message: "Test notification sent successfully" });
    } else {
      return NextResponse.json(
        { error: result.error || "Failed to send test notification" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error testing channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
