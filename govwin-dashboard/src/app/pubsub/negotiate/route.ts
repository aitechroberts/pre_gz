// src/app/api/pubsub/negotiate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pubSubClient } from "@/lib/pubsub-server";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "anonymous";
  const { url } = await pubSubClient.getClientAccessToken({ userId });
  return NextResponse.json({ url });
}