import { createAgent } from "./aztp-client.js";
import { resolveAuthSession } from "./auth.js";
import { buildProfileKey, loadState, saveState } from "./state-store.js";
import { CeroneConfigError } from "./types.js";
function requireAgentRegistrationConfig(config) {
    if (!config.agentPurpose) {
        throw new CeroneConfigError("agentPurpose is required when autoRegisterAgent is enabled and no persisted agent_id exists");
    }
    if (config.agentCapabilities.length === 0) {
        throw new CeroneConfigError("agentCapabilities must include at least one real Cerone capability when autoRegisterAgent is enabled and no persisted agent_id exists");
    }
}
export async function ensureBootstrapState(config) {
    const persisted = config.persistAgentId ? await loadState(config.stateFilePath) : null;
    const authSession = await resolveAuthSession({
        config,
        cachedTrialToken: persisted?.trialToken,
    });
    if (!authSession) {
        return null;
    }
    const profileKey = buildProfileKey(config, authSession.source);
    const reusableState = persisted && persisted.profileKey === profileKey ? persisted : null;
    let agentId = reusableState?.agentId;
    if (!agentId) {
        if (!config.autoRegisterAgent) {
            return null;
        }
        requireAgentRegistrationConfig(config);
        agentId = await createAgent({
            config,
            apiKey: authSession.apiKey,
            purpose: config.agentPurpose,
            capabilities: config.agentCapabilities,
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
    };
}
