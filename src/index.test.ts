import { describe, expect, it } from "vitest";

import { ensureBootstrapState } from "./agent-bootstrap.js";
import { buildValidationRequest } from "./aztp-client.js";
import { resolvePluginConfig } from "./config.js";
import { mapValidationResult } from "./map-result.js";
import { CeroneConfigError } from "./types.js";

describe("cerone-openclaw-plugin config", () => {
  it("uses AZTP-aligned defaults", () => {
    const config = resolvePluginConfig({});
    expect(config.baseUrl).toBe("https://aztp-homer-semantics.onrender.com");
    expect(config.flaggedBehavior).toBe("requireApproval");
    expect(config.networkFailureBehavior).toBe("allow");
    expect(config.timeoutMs).toBe(1000);
    expect(config.approvalTimeoutMs).toBe(120000);
    expect(config.trialMode).toBe("auto");
    expect(config.autoRegisterAgent).toBe(true);
    expect(config.agentPurpose).toBeUndefined();
    expect(config.agentCapabilities).toEqual([]);
  });
});

describe("cerone-openclaw-plugin bootstrap requirements", () => {
  it("requires explicit agent registration config when no persisted agent exists", async () => {
    const config = resolvePluginConfig({
      apiKey: "sk_live_configured",
      trialMode: "off",
      autoRegisterAgent: true,
      persistAgentId: false,
    });

    await expect(ensureBootstrapState(config)).rejects.toBeInstanceOf(CeroneConfigError);
  });
});

describe("cerone-openclaw-plugin result mapping", () => {
  const baseConfig = resolvePluginConfig({});
  const event = {
    toolName: "file_write",
    params: { path: "src/index.ts" },
  };

  it("allows approved results", () => {
    expect(
      mapValidationResult({
        config: baseConfig,
        event,
        response: { result: "approved" },
        pluginId: "cerone-openclaw-plugin",
      }),
    ).toBeUndefined();
  });

  it("blocks rejected results", () => {
    expect(
      mapValidationResult({
        config: baseConfig,
        event,
        response: { result: "rejected", violations: ["policy_blocked"] },
        pluginId: "cerone-openclaw-plugin",
      }),
    ).toEqual({
      block: true,
      blockReason: "policy_blocked",
    });
  });

  it("requires approval for flagged results by default", () => {
    expect(
      mapValidationResult({
        config: baseConfig,
        event,
        response: { result: "flagged", violations: ["review_required"] },
        pluginId: "cerone-openclaw-plugin",
      }),
    ).toMatchObject({
      requireApproval: {
        title: "Cerone flagged file_write",
        description: "review_required",
        severity: "warning",
        timeoutMs: 120000,
        timeoutBehavior: "deny",
        pluginId: "cerone-openclaw-plugin",
      },
    });
  });

  it("allows flagged results when configured", () => {
    const config = resolvePluginConfig({ flaggedBehavior: "allow" });
    expect(
      mapValidationResult({
        config,
        event,
        response: { result: "flagged", violations: ["review_required"] },
        pluginId: "cerone-openclaw-plugin",
      }),
    ).toBeUndefined();
  });

  it("blocks flagged results when configured", () => {
    const config = resolvePluginConfig({ flaggedBehavior: "block" });
    expect(
      mapValidationResult({
        config,
        event,
        response: { result: "flagged", violations: ["review_required"] },
        pluginId: "cerone-openclaw-plugin",
      }),
    ).toEqual({
      block: true,
      blockReason: "review_required",
    });
  });

  it("blocks when trial stoploss is reached", () => {
    expect(
      mapValidationResult({
        config: baseConfig,
        event,
        response: { result: "approved", trial_stoploss: true },
        pluginId: "cerone-openclaw-plugin",
      }),
    ).toEqual({
      block: true,
      blockReason: "Trial limit reached",
    });
  });

  it("falls back to a generic description when violations are missing", () => {
    expect(
      mapValidationResult({
        config: baseConfig,
        event,
        response: { result: "flagged" },
        pluginId: "cerone-openclaw-plugin",
      }),
    ).toMatchObject({
      requireApproval: {
        description: "Cerone flagged file_write",
      },
    });
  });
});

describe("cerone-openclaw-plugin request shape", () => {
  it("builds the AZTP validation schema", () => {
    expect(
      buildValidationRequest({
        agentId: "agt_test_123",
        toolName: "file_write",
        toolParams: { path: "src/index.ts" },
        context: {
          source: "openclaw",
          sessionKey: "session-key",
          sessionId: "session-id",
          runId: "run-id",
          channelId: "channel-id",
          toolCallId: "tool-call-id",
          derivedPaths: ["src/index.ts"],
        },
        timeoutMs: 1000,
      }),
    ).toEqual({
      agent_id: "agt_test_123",
      action: {
        tool: "file_write",
        parameters: { path: "src/index.ts" },
        context: {
          source: "openclaw",
          sessionKey: "session-key",
          sessionId: "session-id",
          runId: "run-id",
          channelId: "channel-id",
          toolCallId: "tool-call-id",
          derivedPaths: ["src/index.ts"],
        },
      },
      blocking: true,
      timeout_ms: 1000,
    });
  });
});
