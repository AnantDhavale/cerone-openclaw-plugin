import { describe, expect, it } from "vitest";

import { resolveAgentProfile } from "./agent-profile.js";
import { ensureBootstrapState } from "./agent-bootstrap.js";
import { buildValidationRequest } from "./aztp-client.js";
import { resolvePluginConfig } from "./config.js";
import { mapValidationResult } from "./map-result.js";

describe("cerone-openclaw-plugin config", () => {
  it("uses AZTP-aligned defaults", () => {
    const config = resolvePluginConfig({});
    expect(config.baseUrl).toBe("https://api.homersemantics.com");
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

describe("cerone-openclaw-plugin inferred profile", () => {
  it("derives a coding-oriented profile from a file tool", () => {
    const profile = resolveAgentProfile(resolvePluginConfig({}), {
      toolName: "file_read",
      params: { path: "README.md" },
      derivedPaths: ["README.md"],
    });

    expect(profile.inferred).toBe(true);
    expect(profile.purpose).toContain("Perform file_read operations");
    expect(profile.purpose).toContain("read files from a codebase");
    expect(profile.purpose).toContain("README.md");
    expect(profile.capabilities).toEqual(["file_read"]);
  });

  it("adds unknown tool names as explicit capabilities", () => {
    const profile = resolveAgentProfile(resolvePluginConfig({}), {
      toolName: "tweetclaw",
      params: {},
    });

    expect(profile.capabilities[0]).toBe("tweetclaw");
    expect(profile.purpose).toContain("Perform tweetclaw operations");
  });

  it("uses the explicit profile when provided", () => {
    const profile = resolveAgentProfile(
      resolvePluginConfig({
        agentPurpose: "Inspect repositories safely",
        agentCapabilities: ["file_read"],
      }),
      {
        toolName: "file_read",
        params: {},
      },
    );

    expect(profile.inferred).toBe(false);
    expect(profile.purpose).toBe("Inspect repositories safely");
    expect(profile.capabilities).toEqual(["file_read"]);
  });

  it("keeps an explicit purpose while deriving capabilities when only purpose is provided", () => {
    const profile = resolveAgentProfile(
      resolvePluginConfig({
        agentPurpose: "Inspect repositories safely",
      }),
      {
        toolName: "file_write",
        params: {},
      },
    );

    expect(profile.inferred).toBe(true);
    expect(profile.purpose).toBe("Inspect repositories safely");
    expect(profile.capabilities).toEqual(["file_write"]);
  });
});

describe("cerone-openclaw-plugin bootstrap requirements", () => {
  it("returns null when no auth session is available and trial mode is off", async () => {
    const config = resolvePluginConfig({
      trialMode: "off",
      autoRegisterAgent: true,
      persistAgentId: false,
    });

    await expect(
      ensureBootstrapState(config, {
        toolName: "file_read",
        params: { path: "README.md" },
      }),
    ).resolves.toBeNull();
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

  it("deduplicates repeated semantic drift prefixes", () => {
    expect(
      mapValidationResult({
        config: baseConfig,
        event,
        response: {
          result: "rejected",
          violations: [
            "Semantic drift detected: Semantic drift detected: alignment score 0.35 below threshold",
          ],
        },
        pluginId: "cerone-openclaw-plugin",
      }),
    ).toEqual({
      block: true,
      blockReason: "Semantic drift detected: alignment score 0.35 below threshold",
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
