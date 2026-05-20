import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { resolveAgentProfile } from "./agent-profile.js";
import { ensureBootstrapState } from "./agent-bootstrap.js";
import { buildValidationRequest, validateToolCall } from "./aztp-client.js";
import { resolvePluginConfig } from "./config.js";
import { mapValidationResult } from "./map-result.js";
import type { CeronePluginConfig, HookToolContext, HookToolEvent } from "./types.js";
import { CeroneConfigError, CeroneHttpError } from "./types.js";

function buildActionContext(
  config: CeronePluginConfig,
  event: HookToolEvent,
  ctx: HookToolContext,
) {
  if (!config.includeContext) {
    return undefined;
  }

  const actionContext = {
    source: "openclaw" as const,
    sessionKey: ctx.sessionKey,
    sessionId: ctx.sessionId,
    runId: ctx.runId ?? event.runId,
    channelId: ctx.channelId,
    toolCallId: event.toolCallId,
  };

  if (!config.includeDerivedPaths) {
    return actionContext;
  }

  const derivedPaths = Array.isArray(event.derivedPaths)
    ? event.derivedPaths.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    ...actionContext,
    derivedPaths,
  };
}

function networkFailureDecision(
  config: CeronePluginConfig,
  error: CeroneHttpError,
) {
  if (config.networkFailureBehavior === "allow") {
    return undefined;
  }
  return {
    block: true as const,
    blockReason: `Cerone unavailable: ${error.message}`,
  };
}

function networkFailureLogMessage(
  phase: "bootstrap" | "validation",
  config: CeronePluginConfig,
  error: CeroneHttpError,
) {
  const behavior = config.networkFailureBehavior === "allow" ? "failed open" : "blocked";
  return `Cerone ${phase} ${behavior}: ${error.message}`;
}

export default definePluginEntry({
  id: "cerone-openclaw-plugin",
  name: "Cerone OpenClaw Plugin",
  description: "Validate OpenClaw tool calls with Cerone/AZTP before execution.",
  register(api) {
    let bootstrapPromise: Promise<Awaited<ReturnType<typeof ensureBootstrapState>>> | null = null;
    let bootstrappedState: Awaited<ReturnType<typeof ensureBootstrapState>> | undefined;
    let bootstrappedConfigKey: string | undefined;

    const configKeyFor = (config: CeronePluginConfig) =>
      JSON.stringify({
        apiKey: Boolean(config.apiKey),
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
        trialMode: config.trialMode,
        autoRegisterAgent: config.autoRegisterAgent,
        persistAgentId: config.persistAgentId,
        agentPurpose: config.agentPurpose,
        agentCapabilities: [...config.agentCapabilities].sort(),
        agentEnvironment: config.agentEnvironment,
        stateFilePath: config.stateFilePath,
      });

    const getBootstrapState = async (config: CeronePluginConfig, event: HookToolEvent) => {
      const resolvedProfile = resolveAgentProfile(config, event);
      const configKey = configKeyFor({
        ...config,
        agentPurpose: resolvedProfile.purpose,
        agentCapabilities: [...resolvedProfile.capabilities],
      });
      if (bootstrappedConfigKey && bootstrappedConfigKey !== configKey) {
        bootstrappedState = undefined;
      }
      if (bootstrappedState && bootstrappedConfigKey === configKey) {
        return bootstrappedState;
      }
      if (!bootstrapPromise) {
        bootstrapPromise = ensureBootstrapState(config, event)
          .then((resolved) => {
            bootstrappedState = resolved;
            bootstrappedConfigKey = configKey;
            return resolved;
          })
          .finally(() => {
            bootstrapPromise = null;
          });
      }
      return bootstrapPromise;
    };

    api.on(
      "before_tool_call",
      async (event, ctx) => {
        const config = resolvePluginConfig(api.pluginConfig);

        let session;
        try {
          session = await getBootstrapState(config, event);
        } catch (error) {
          if (error instanceof CeroneConfigError) {
            return {
              block: true,
              blockReason: `Cerone initialization failed: ${error.message}`,
            };
          }
          if (error instanceof CeroneHttpError) {
            if (error.kind === "network" || error.kind === "server") {
              api.logger.warn(networkFailureLogMessage("bootstrap", config, error));
              return networkFailureDecision(config, error);
            }
            return {
              block: true,
              blockReason: `Cerone initialization failed: ${error.message}`,
            };
          }
          throw error;
        }

        if (!session) {
          return;
        }

        const request = buildValidationRequest({
          agentId: session.agentId,
          toolName: event.toolName,
          toolParams: event.params,
          context: buildActionContext(config, event, ctx),
          timeoutMs: config.timeoutMs,
        });

        try {
          const response = await validateToolCall({
            config,
            apiKey: session.apiKey,
            body: request,
          });

          if (response.trial_warning) {
            api.logger.warn(
              `Cerone trial warning for ${event.toolName}: trial usage is approaching stoploss.`,
            );
          }

          return mapValidationResult({
            config,
            event,
            response,
            pluginId: api.id,
            onResolution(decision) {
              api.logger.info(`Cerone approval for ${event.toolName}: ${decision}`);
            },
          });
        } catch (error) {
          if (error instanceof CeroneHttpError) {
            if (error.kind === "network" || error.kind === "server") {
              api.logger.warn(networkFailureLogMessage("validation", config, error));
              return networkFailureDecision(config, error);
            }
            return {
              block: true,
              blockReason: `Cerone validation failed: ${error.message}`,
            };
          }
          throw error;
        }
      },
      { priority: 50, timeoutMs: 5000 },
    );
  },
});
