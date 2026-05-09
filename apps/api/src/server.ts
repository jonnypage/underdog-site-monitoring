import cors from "@fastify/cors";
import { createDb } from "@app/db";
import { createYoga } from "graphql-yoga";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { env } from "./env.js";
import { EmailNotifier } from "./alerts/notify.js";
import { createContext } from "./context.js";
import { schema } from "./graphql/schema.js";
import { registerIngestRoute } from "./ingest/route.js";
import { startScheduler } from "./scheduler.js";

const db = createDb();
const notifier = new EmailNotifier(db);
const app = Fastify({ logger: true });

const devCors = process.env.NODE_ENV !== "production";

await app.register(cors, {
  // In development, reflect the browser Origin so localhost vs 127.0.0.1 and port changes
  // still work without editing WEB_ORIGIN. Production keeps a single allowed origin.
  origin: devCors ? true : env.WEB_ORIGIN,
  credentials: true
});

const yoga = createYoga<{ req: FastifyRequest; reply: FastifyReply }>({
  schema,
  graphqlEndpoint: "/graphql",
  context: async ({ request }) => {
    const cookie = request.headers.get("cookie") ?? undefined;
    return createContext(db, { headers: { cookie } } as never);
  }
});

app.route({
  url: "/graphql",
  method: ["GET", "POST", "OPTIONS"],
  handler: (request, reply) =>
    yoga.handleNodeRequestAndResponse(request, reply, {
      req: request,
      reply
    })
});

registerIngestRoute(app, db, notifier);

app.get("/health", async () => ({ ok: true }));

const stopScheduler = startScheduler(db, notifier);

const shutdown = async () => {
  stopScheduler();
  await app.close();
  await db.destroy();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: "0.0.0.0", port: env.PORT });
