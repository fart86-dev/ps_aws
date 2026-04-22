import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { checkInfrastructure } from "./infra-monitor";
import type { InfraMonitorResult } from "./types";

const fastify = Fastify({
  logger: true,
});

fastify.get("/health", async () => {
  return { status: "ok" };
});

fastify.post("/infra/monitor", async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    const result = await checkInfrastructure();
    reply.code(200).send(result);
  } catch (error) {
    reply.code(500).send({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

interface ServiceParams {
  Params: { service: string };
}

fastify.get<ServiceParams>(
  "/infra/monitor/:service",
  async (request: FastifyRequest<ServiceParams>, reply: FastifyReply) => {
    try {
      const { service } = request.params;
      const validServices = ["rds", "dynamodb", "waf"] as const;

      if (!validServices.includes(service as any)) {
        return reply.code(400).send({
          error: "Invalid service",
          available: validServices,
        });
      }

      const result = await checkInfrastructure();
      const data = result[service as keyof InfraMonitorResult];

      reply.code(200).send(data);
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
