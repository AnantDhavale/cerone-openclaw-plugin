import os from "node:os";
import path from "node:path";
const DEFAULT_STATE_PATH = path.join(os.homedir(), ".openclaw", "plugin-state", "cerone-openclaw-plugin.json");
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function asString(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}
function asBoolean(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
}
function asNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
function asStringArray(value, fallback) {
    if (!Array.isArray(value)) {
        return fallback;
    }
    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean);
}
export function resolvePluginConfig(raw) {
    const cfg = isRecord(raw) ? raw : {};
    return {
        apiKey: asString(cfg.apiKey),
        baseUrl: asString(cfg.baseUrl)?.replace(/\/+$/u, "") ??
            "https://aztp-homer-semantics.onrender.com",
        timeoutMs: asNumber(cfg.timeoutMs, 1000),
        flaggedBehavior: cfg.flaggedBehavior === "allow" || cfg.flaggedBehavior === "block"
            ? cfg.flaggedBehavior
            : "requireApproval",
        networkFailureBehavior: cfg.networkFailureBehavior === "block" ? "block" : "allow",
        approvalTimeoutMs: asNumber(cfg.approvalTimeoutMs, 120000),
        includeContext: asBoolean(cfg.includeContext, true),
        includeDerivedPaths: asBoolean(cfg.includeDerivedPaths, true),
        trialMode: cfg.trialMode === "off" ? "off" : "auto",
        autoRegisterAgent: asBoolean(cfg.autoRegisterAgent, true),
        persistAgentId: asBoolean(cfg.persistAgentId, true),
        agentPurpose: asString(cfg.agentPurpose),
        agentCapabilities: asStringArray(cfg.agentCapabilities, []),
        agentEnvironment: cfg.agentEnvironment === "staging" || cfg.agentEnvironment === "production"
            ? cfg.agentEnvironment
            : "development",
        stateFilePath: asString(cfg.stateFilePath) ?? DEFAULT_STATE_PATH,
    };
}
