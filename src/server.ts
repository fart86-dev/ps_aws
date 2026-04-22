import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { checkInfrastructure, monitorRDS, monitorDynamoDB, monitorWAF } from "./infra-monitor";
import {
  sendIssueAlert,
  sendFullReport,
  listConfiguredNotifiers,
} from "./notifiers";
import { startScheduler, stopScheduler, isSchedulerRunning } from "./scheduler";

const fastify = Fastify({
  logger: true,
});

const serviceMonitors = {
  rds: monitorRDS,
  dynamodb: monitorDynamoDB,
  waf: monitorWAF,
} as const;

interface MonitorQuery {
  Querystring: { notify?: "true" | "issues" | "false" };
}

fastify.get("/health", async () => {
  return {
    status: "ok",
    notifiers: listConfiguredNotifiers(),
    scheduler: {
      running: isSchedulerRunning(),
      schedule: process.env.CRON_SCHEDULE || "*/30 * * * *",
      notifyMode: process.env.NOTIFY_MODE || "issues",
    },
  };
});

fastify.post<MonitorQuery>(
  "/infra/monitor",
  async (request: FastifyRequest<MonitorQuery>, reply: FastifyReply) => {
    try {
      const result = await checkInfrastructure();
      const notify = request.query?.notify ?? "issues";

      if (notify === "true") {
        await sendFullReport(result);
      } else if (notify === "issues") {
        await sendIssueAlert(result);
      }

      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

interface ServiceParams {
  Params: { service: string };
}

fastify.get<ServiceParams>(
  "/infra/monitor/:service",
  async (request: FastifyRequest<ServiceParams>, reply: FastifyReply) => {
    try {
      const { service } = request.params;
      const validServices = Object.keys(serviceMonitors);

      if (!validServices.includes(service)) {
        return reply.code(400).send({
          error: "Invalid service",
          available: validServices,
        });
      }

      const monitor = serviceMonitors[service as keyof typeof serviceMonitors];
      const data = await monitor();

      reply.code(200).send(data);
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export async function startServer(port: number = 3000, enableScheduler: boolean = true) {
  try {
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on port ${port}`);

    if (enableScheduler) {
      startScheduler();
    }

    const shutdown = () => {
      console.log("Shutting down...");
      stopScheduler();
      fastify.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

export { fastify };
