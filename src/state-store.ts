import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { CeronePluginConfig, PersistentState } from "./types.js";

export function buildProfileKey(config: CeronePluginConfig, authMode: "configured" | "trial"): string {
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify({
      baseUrl: config.baseUrl,
      authMode,
      agentPurpose: config.agentPurpose,
      agentCapabilities: [...config.agentCapabilities].sort(),
      agentEnvironment: config.agentEnvironment,
    }),
  );
  return hash.digest("hex");
}

export async function loadState(stateFilePath: string | undefined): Promise<PersistentState | null> {
  if (!stateFilePath) {
    return null;
  }
  try {
    const raw = await fs.readFile(stateFilePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistentState>;
    if (parsed.version !== 1 || typeof parsed.profileKey !== "string") {
      return null;
    }
    return {
      version: 1,
      profileKey: parsed.profileKey,
      trialToken: typeof parsed.trialToken === "string" ? parsed.trialToken : undefined,
      agentId: typeof parsed.agentId === "string" ? parsed.agentId : undefined,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveState(
  stateFilePath: string | undefined,
  state: PersistentState | null,
): Promise<void> {
  if (!stateFilePath) {
    return;
  }
  if (!state) {
    try {
      await fs.unlink(stateFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    return;
  }
  await fs.mkdir(path.dirname(stateFilePath), { recursive: true });
  await fs.writeFile(stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
