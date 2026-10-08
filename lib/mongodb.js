import { MongoClient } from "mongodb";
import dns from "node:dns";

const globalForMongo = globalThis;
let clientPromise = globalForMongo.daymarkMongoPromise;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  if (!clientPromise) {
    const dnsServers = process.env.MONGODB_DNS_SERVERS
      ?.split(",")
      .map((server) => server.trim())
      .filter(Boolean);
    if (dnsServers?.length) dns.setServers(dnsServers);

    clientPromise = new MongoClient(uri).connect().catch((error) => {
      clientPromise = undefined;
      delete globalForMongo.daymarkMongoPromise;
      throw error;
    });
    if (process.env.NODE_ENV !== "production") {
      globalForMongo.daymarkMongoPromise = clientPromise;
    }
  }

  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "daymark");
}

export function getMongoErrorMessage(error) {
  if (error?.code === "ECONNREFUSED" && error?.syscall === "querySrv") {
    return "Node could not reach its configured DNS resolver for MongoDB Atlas. Set MONGODB_DNS_SERVERS in .env.local, then restart the dev server.";
  }
  return "Account service is unavailable. Check the MongoDB configuration and try again.";
}

export async function getUsersCollection() {
  const collection = (await getDb()).collection("users");
  const indexState = globalForMongo.daymarkUserIndexState;

  if (!indexState) {
    const indexPromise = collection.createIndex({ email: 1 }, { unique: true });
    globalForMongo.daymarkUserIndexState = indexPromise;
    try {
      await indexPromise;
    } catch (error) {
      delete globalForMongo.daymarkUserIndexState;
      throw error;
    }
  } else {
    await indexState;
  }

  return collection;
}