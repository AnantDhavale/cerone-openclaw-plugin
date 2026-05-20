import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
export function buildProfileKey(params) {
    const hash = createHash("sha256");
    hash.update(JSON.stringify({
        baseUrl: params.baseUrl,
        authMode: params.authMode,
        agentPurpose: params.profile.purpose,
        agentCapabilities: [...params.profile.capabilities].sort(),
        agentEnvironment: params.agentEnvironment,
    }));
    return hash.digest("hex");
}
export async function loadState(stateFilePath) {
    if (!stateFilePath) {
        return null;
    }
    try {
        const raw = await fs.readFile(stateFilePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1 || typeof parsed.profileKey !== "string") {
            return null;
        }
        return {
            version: 1,
            profileKey: parsed.profileKey,
            trialToken: typeof parsed.trialToken === "string" ? parsed.trialToken : undefined,
            agentId: typeof parsed.agentId === "string" ? parsed.agentId : undefined,
        };
    }
    catch (error) {
        const code = error.code;
        if (code === "ENOENT") {
            return null;
        }
        throw error;
    }
}
export async function saveState(stateFilePath, state) {
    if (!stateFilePath) {
        return;
    }
    if (!state) {
        try {
            await fs.unlink(stateFilePath);
        }
        catch (error) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }
        return;
    }
    await fs.mkdir(path.dirname(stateFilePath), { recursive: true });
    await fs.writeFile(stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
