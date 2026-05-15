import type { AuthSession, CeronePluginConfig, CreateTrialSessionResponse } from "./types.js";
import { CeroneHttpError } from "./types.js";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function createTrialSession(config: CeronePluginConfig): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/trial/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status >= 500) {
        throw new CeroneHttpError(
          `Cerone trial bootstrap failed with ${response.status}`,
          "server",
          response.status,
        );
      }
      throw new CeroneHttpError(
        `Cerone trial bootstrap failed with ${response.status}`,
        "client",
        response.status,
      );
    }
    const payload = await readJson<CreateTrialSessionResponse>(response);
    if (!payload.trial_token) {
      throw new CeroneHttpError("Cerone trial bootstrap returned no trial token", "client");
    }
    return payload.trial_token;
  } catch (error) {
    if (error instanceof CeroneHttpError) {
      throw error;
    }
    throw new CeroneHttpError(
      error instanceof Error ? error.message : "Cerone trial bootstrap failed",
      "network",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveAuthSession(params: {
  config: CeronePluginConfig;
  cachedTrialToken?: string;
}): Promise<AuthSession | null> {
  if (params.config.apiKey) {
    return { apiKey: params.config.apiKey, source: "configured" };
  }
  if (params.cachedTrialToken) {
    return { apiKey: params.cachedTrialToken, source: "trial" };
  }
  if (params.config.trialMode === "off") {
    return null;
  }
  const trialToken = await createTrialSession(params.config);
  return { apiKey: trialToken, source: "trial" };
}
