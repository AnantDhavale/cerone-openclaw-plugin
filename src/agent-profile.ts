import type { CeronePluginConfig, HookToolEvent, ResolvedAgentProfile } from "./types.js";

function normalizeToolName(toolName: string): string {
  return toolName.trim().toLowerCase();
}

function inferRequiredCapability(toolName: string): string {
  const normalized = normalizeToolName(toolName);
  if (normalized.startsWith("database_") || normalized.startsWith("db_")) {
    return /(write|update|insert|delete|create)/u.test(normalized) ? "db_write" : "db_read";
  }

  if (normalized.startsWith("api_") || normalized.endsWith("_api")) {
    return "api_call";
  }

  if (normalized.startsWith("file_")) {
    return /(write|update|create|delete)/u.test(normalized) ? "file_write" : "file_read";
  }

  if (
    normalized.includes("http") ||
    normalized.includes("fetch") ||
    normalized.includes("search") ||
    normalized.includes("browse") ||
    normalized.includes("network")
  ) {
    return "network_access";
  }

  return normalized;
}

function minimalCapabilities(requiredCapability: string): [string, ...string[]] {
  return [requiredCapability];
}

function describeWorkspaceTarget(event: HookToolEvent): string {
  const firstPath = Array.isArray(event.derivedPaths)
    ? event.derivedPaths.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : undefined;
  if (!firstPath) {
    return "repositories, project files, and connected development tools";
  }
  return `repositories and project files such as ${firstPath}`;
}

function inferPurpose(
  requiredCapability: string,
  event: HookToolEvent,
  workspaceTarget: string,
): string {
  switch (requiredCapability) {
    case "file_read":
      return (
        `Perform ${event.toolName} operations to read files from a codebase and inspect ${workspaceTarget} ` +
        "for source code analysis, configuration review, debugging, and implementation planning."
      );
    case "file_write":
      return (
        `Perform ${event.toolName} operations to update project files within ${workspaceTarget} ` +
        "for software engineering changes, fixes, and implementation tasks."
      );
    case "api_call":
      return (
        `Perform ${event.toolName} operations to call development and service APIs needed for ` +
        "software engineering workflows, diagnostics, and implementation tasks."
      );
    case "network_access":
      return (
        `Perform ${event.toolName} operations to access network resources relevant to ${workspaceTarget} ` +
        "for software engineering research, dependency inspection, and debugging."
      );
    case "db_read":
      return (
        `Perform ${event.toolName} operations to read database records needed for debugging, ` +
        "system analysis, and software engineering investigation."
      );
    case "db_write":
      return (
        `Perform ${event.toolName} operations to update database records required for controlled ` +
        "software engineering workflows and operational fixes."
      );
    default:
      return (
        `Perform ${event.toolName} operations within OpenClaw to work with ${workspaceTarget} ` +
        "for software engineering, debugging, and workflow tasks."
      );
  }
}

export function resolveAgentProfile(
  config: CeronePluginConfig,
  event: HookToolEvent,
): ResolvedAgentProfile {
  const requiredCapability = inferRequiredCapability(event.toolName);
  const capabilities =
    config.agentCapabilities.length > 0
      ? (config.agentCapabilities as [string, ...string[]])
      : minimalCapabilities(requiredCapability);
  const workspaceTarget = describeWorkspaceTarget(event);
  const purpose =
    config.agentPurpose ??
    inferPurpose(requiredCapability, event, workspaceTarget);

  const inferred = !(config.agentPurpose && config.agentCapabilities.length > 0);

  return {
    purpose,
    capabilities,
    inferred,
  };
}
