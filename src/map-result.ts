import type {
  CeronePluginConfig,
  CeroneValidationResponse,
  HookDecision,
  HookToolEvent,
} from "./types.js";

type ApprovalResolutionHandler = NonNullable<NonNullable<HookDecision["requireApproval"]>["onResolution"]>;

function deriveReason(response: CeroneValidationResponse, event: HookToolEvent): string {
  const firstViolation = response.violations?.find((entry) => typeof entry === "string" && entry.trim());
  if (firstViolation) {
    return firstViolation;
  }
  return `Cerone flagged ${event.toolName}`;
}

export function mapValidationResult(params: {
  config: CeronePluginConfig;
  event: HookToolEvent;
  response: CeroneValidationResponse;
  pluginId: string;
  onResolution?: ApprovalResolutionHandler;
}): HookDecision | undefined {
  const { config, event, response, pluginId } = params;
  const reason = deriveReason(response, event);

  if (response.trial_stoploss) {
    return {
      block: true,
      blockReason: "Trial limit reached",
    };
  }

  if (response.result === "approved") {
    return undefined;
  }

  if (response.result === "rejected") {
    return {
      block: true,
      blockReason: reason,
    };
  }

  if (config.flaggedBehavior === "allow") {
    return undefined;
  }

  if (config.flaggedBehavior === "block") {
    return {
      block: true,
      blockReason: reason,
    };
  }

  return {
    requireApproval: {
      title: `Cerone flagged ${event.toolName}`,
      description: reason,
      severity: "warning",
      timeoutMs: config.approvalTimeoutMs,
      timeoutBehavior: "deny",
      pluginId,
      onResolution: params.onResolution,
    },
  };
}
