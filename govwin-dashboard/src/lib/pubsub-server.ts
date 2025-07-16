// src/lib/pubsub-server.ts
import { WebPubSubServiceClient } from "@azure/web-pubsub";

const connectionString = process.env.WEBPUBSUB_CONNECTION_STRING!;
const hub = process.env.WEBPUBSUB_HUB || "opportunities_optimized";

// Re-use one client instance for all API routes
export const pubSubClient = new WebPubSubServiceClient(connectionString, hub);