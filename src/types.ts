export type FlaggedBehavior = "requireApproval" | "allow" | "block";
export type NetworkFailureBehavior = "allow" | "block";
export type TrialMode = "auto" | "off";
export type AgentEnvironment = "development" | "staging" | "production";

export type CeronePluginConfig = {
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  flaggedBehavior: FlaggedBehavior;
  networkFailureBehavior: NetworkFailureBehavior;
  approvalTimeoutMs: number;
  includeContext: boolean;
  includeDerivedPaths: boolean;
  trialMode: TrialMode;
  autoRegisterAgent: boolean;
  persistAgentId: boolean;
  agentPurpose?: string;
  agentCapabilities: string[];
  agentEnvironment: AgentEnvironment;
  stateFilePath?: string;
};

export type PersistentState = {
  version: 1;
  profileKey: string;
  trialToken?: string;
  agentId?: string;
};

export type AuthSession = {
  apiKey: string;
  source: "configured" | "trial";
};

export type BootstrapState = {
  apiKey: string;
  agentId: string;
  source: "configured" | "trial";
  profileKey: string;
};

export type CeroneActionContext = {
  source: "openclaw";
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  channelId?: string;
  toolCallId?: string;
  derivedPaths?: string[];
};

export type CeroneValidationRequest = {
  agent_id: string;
  action: {
    tool: string;
    parameters: Record<string, unknown>;
    context?: CeroneActionContext;
  };
  blocking: true;
  timeout_ms: number;
};

export type CeroneValidationResponse = {
  validation_id?: string;
  agent_id?: string;
  result: "approved" | "flagged" | "rejected";
  trust_score?: number | null;
  violations?: string[];
  trial_warning?: boolean;
  trial_stoploss?: boolean;
  latency_ms?: number;
  checks?: unknown[];
  timestamp?: string;
};

export type CreateTrialSessionResponse = {
  trial_token: string;
};

export type CertificateResponse = {
  certificate?: {
    agent_id?: string;
  };
};

export type HookToolEvent = {
  toolName: string;
  params: Record<string, unknown>;
  runId?: string;
  toolCallId?: string;
  derivedPaths?: readonly string[];
};

export type ResolvedAgentProfile = {
  purpose: string;
  capabilities: [string, ...string[]];
  inferred: boolean;
};

export type HookToolContext = {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  channelId?: string;
};

export type HookDecision = {
  params?: Record<string, unknown>;
  block?: boolean;
  blockReason?: string;
  requireApproval?: {
    title: string;
    description: string;
    severity?: "info" | "warning" | "critical";
    timeoutMs?: number;
    timeoutBehavior?: "allow" | "deny";
    pluginId?: string;
    onResolution?: (
      decision: "allow-once" | "allow-always" | "deny" | "timeout" | "cancelled",
    ) => Promise<void> | void;
  };
};

export class CeroneHttpError extends Error {
  readonly kind: "client" | "server" | "network";
  readonly status?: number;

  constructor(message: string, kind: "client" | "server" | "network", status?: number) {
    super(message);
    this.name = "CeroneHttpError";
    this.kind = kind;
    this.status = status;
  }
}

export class CeroneConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CeroneConfigError";
  }
}
