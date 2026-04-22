import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { checkInfrastructure } from "./infra-monitor";

const fastify = Fastify({
  logger: true,
});

fastify.get("/health", async () => {
  return { status: "ok" };
});

fastify.post(
  "/infra/monitor",
  async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await checkInfrastructure();
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

fastify.get(
  "/infra/monitor/rds",
  async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await checkInfrastructure();
      reply.code(200).send(result.rds);
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

fastify.get(
  "/infra/monitor/dynamodb",
  async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await checkInfrastructure();
      reply.code(200).send(result.dynamodb);
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

fastify.get(
  "/infra/monitor/waf",
  async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await checkInfrastructure();
      reply.code(200).send(result.waf);
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export async function startServer(port: number = 3000) {
  try {
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on port ${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

export { fastify };
