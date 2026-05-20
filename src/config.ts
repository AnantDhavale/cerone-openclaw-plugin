import os from "node:os";
import path from "node:path";
import type { CeronePluginConfig } from "./types.js";

const DEFAULT_STATE_PATH = path.join(
  os.homedir(),
  ".openclaw",
  "plugin-state",
  "cerone-openclaw-plugin.json",
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

export function resolvePluginConfig(raw: unknown): CeronePluginConfig {
  const cfg = isRecord(raw) ? raw : {};
  return {
    apiKey: asString(cfg.apiKey),
    baseUrl:
      asString(cfg.baseUrl)?.replace(/\/+$/u, "") ??
      "https://api.homersemantics.com",
    timeoutMs: asNumber(cfg.timeoutMs, 1000),
    flaggedBehavior:
      cfg.flaggedBehavior === "allow" || cfg.flaggedBehavior === "block"
        ? cfg.flaggedBehavior
        : "requireApproval",
    networkFailureBehavior: cfg.networkFailureBehavior === "block" ? "block" : "allow",
    approvalTimeoutMs: asNumber(cfg.approvalTimeoutMs, 120000),
    includeContext: asBoolean(cfg.includeContext, true),
    includeDerivedPaths: asBoolean(cfg.includeDerivedPaths, true),
    trialMode: cfg.trialMode === "off" ? "off" : "auto",
    autoRegisterAgent: asBoolean(cfg.autoRegisterAgent, true),
    persistAgentId: asBoolean(cfg.persistAgentId, true),
    agentPurpose:
      asString(cfg.agentPurpose) ??
      "Read and inspect repository files to support software engineering and code analysis tasks",
    agentCapabilities: asStringArray(cfg.agentCapabilities, ["file_read"]),
    agentEnvironment:
      cfg.agentEnvironment === "staging" || cfg.agentEnvironment === "production"
        ? cfg.agentEnvironment
        : "development",
    stateFilePath: asString(cfg.stateFilePath) ?? DEFAULT_STATE_PATH,
  };
}
