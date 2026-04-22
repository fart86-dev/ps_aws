declare module "node-cron" {
  interface ScheduledTask {
    start(): void;
    stop(): void;
    destroy(): void;
    status: boolean;
  }

  function schedule(expression: string, func: () => void): ScheduledTask;
  function validate(expression: string): boolean;
  function schedule(expression: string, func: () => void, options?: { scheduled?: boolean }): ScheduledTask;
}
