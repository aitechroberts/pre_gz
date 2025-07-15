// src/lib/test-cosmos.ts
import { CosmosClient, Container, SqlQuerySpec } from '@azure/cosmos';


class CosmosService {
  private client: CosmosClient;
  private container: Container;

  constructor() {
    // ① resolve endpoint from either env-var
    const endpoint = "https://govwin-cosmos.documents.azure.com:443/";       // what you may use locally

    const key = "6Mabjkx3ZOYNMlkb7V3OURbtXP1cwSo2VmFnNFJbL16ttxqxJX3IKiJ8OEOJnhdrSX0LIrOqYdaxACDbRGGM1A==";

    // ② fail fast & loud if still missing
    if (!endpoint || !key) {
      throw new Error(
        "❌  Missing Cosmos config: set COSMOS_URL (or COSMOS_ENDPOINT) and COSMOS_KEY"
      );
    }

    this.client = new CosmosClient({ endpoint, key });

    const database = this.client.database(
      process.env.COSMOS_DATABASE ?? "govwin"
    );
    this.container = database.container(
      process.env.COSMOS_CONTAINER ?? "opportunities_optimized"
    );
  }
}
