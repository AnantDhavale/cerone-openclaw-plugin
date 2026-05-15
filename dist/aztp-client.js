import { CeroneHttpError } from "./types.js";
async function requestJson(baseUrl, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
        const response = await fetch(`${baseUrl}${options.path}`, {
            method: options.body === undefined ? "GET" : "POST",
            headers: {
                "X-API-Key": options.apiKey,
                "Content-Type": "application/json",
                "User-Agent": "cerone-openclaw-plugin/0.1.0",
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: controller.signal,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const message = text || `Cerone request failed with ${response.status}`;
            if (response.status >= 500) {
                throw new CeroneHttpError(message, "server", response.status);
            }
            throw new CeroneHttpError(message, "client", response.status);
        }
        return (await response.json());
    }
    catch (error) {
        if (error instanceof CeroneHttpError) {
            throw error;
        }
        throw new CeroneHttpError(error instanceof Error ? error.message : "Cerone request failed", "network");
    }
    finally {
        clearTimeout(timeout);
    }
}
export function buildValidationRequest(params) {
    return {
        agent_id: params.agentId,
        action: {
            tool: params.toolName,
            parameters: params.toolParams,
            ...(params.context ? { context: params.context } : {}),
        },
        blocking: true,
        timeout_ms: params.timeoutMs,
    };
}
export async function createAgent(params) {
    const response = await requestJson(params.config.baseUrl, {
        apiKey: params.apiKey,
        path: "/v1/certificates",
        timeoutMs: params.config.timeoutMs,
        body: {
            purpose: params.purpose,
            capabilities: params.capabilities,
            environment: params.environment,
        },
    });
    const agentId = response.certificate?.agent_id;
    if (!agentId) {
        throw new CeroneHttpError("Cerone certificate response did not include agent_id", "client");
    }
    return agentId;
}
export async function validateToolCall(params) {
    return requestJson(params.config.baseUrl, {
        apiKey: params.apiKey,
        path: "/v1/validate",
        timeoutMs: params.config.timeoutMs,
        body: params.body,
    });
}
