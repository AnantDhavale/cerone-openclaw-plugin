import { resolveAgentProfile } from "./agent-profile.js";
import { createAgent } from "./aztp-client.js";
import { resolveAuthSession } from "./auth.js";
import { buildProfileKey, loadState, saveState } from "./state-store.js";
import { CeroneConfigError } from "./types.js";
function validateExplicitProfile(profile) {
    if (!profile.purpose.trim()) {
        throw new CeroneConfigError("agentPurpose must be a non-empty descriptive purpose when provided.");
    }
    if (profile.capabilities.length === 0) {
        throw new CeroneConfigError("agentCapabilities must include at least one Cerone capability when provided.");
    }
}
export async function ensureBootstrapState(config, event) {
    const persisted = config.persistAgentId ? await loadState(config.stateFilePath) : null;
    const authSession = await resolveAuthSession({
        config,
        cachedTrialToken: persisted?.trialToken,
    });
    if (!authSession) {
        return null;
    }
    const profile = resolveAgentProfile(config, event);
    if (!profile.inferred) {
        validateExplicitProfile(profile);
    }
    const profileKey = buildProfileKey({
        baseUrl: config.baseUrl,
        authMode: authSession.source,
        profile,
        agentEnvironment: config.agentEnvironment,
    });
    const reusableState = persisted && persisted.profileKey === profileKey ? persisted : null;
    let agentId = reusableState?.agentId;
    if (!agentId) {
        if (!config.autoRegisterAgent) {
            return null;
        }
        agentId = await createAgent({
            config,
            apiKey: authSession.apiKey,
            purpose: profile.purpose,
            capabilities: profile.capabilities,
            environment: config.agentEnvironment,
        });
    }
    if (config.persistAgentId) {
        await saveState(config.stateFilePath, {
            version: 1,
            profileKey,
            trialToken: authSession.source === "trial" ? authSession.apiKey : undefined,
            agentId,
        });
    }
    return {
        apiKey: authSession.apiKey,
        agentId,
        source: authSession.source,
        profileKey,
    };
}
