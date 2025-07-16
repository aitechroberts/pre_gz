// src/app/api/pubsub/negotiate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pubSubClient } from "@/lib/pubsub-server";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "anonymous";
    try {
    const { url } = await pubSubClient.getClientAccessToken({ userId });
    return NextResponse.json({ url });
    } catch (error) {
    console.error('Negotiate error:', error);
    return NextResponse.json({ error: 'Failed to get token' }, { status: 500 });
    }
}

