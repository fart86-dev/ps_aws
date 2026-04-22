import { InfraMonitorResult } from "../types";

export interface Notifier {
  name: string;
  isConfigured(): boolean;
  sendFullReport(result: InfraMonitorResult): Promise<boolean>;
  sendIssueAlert(result: InfraMonitorResult): Promise<boolean>;
}
