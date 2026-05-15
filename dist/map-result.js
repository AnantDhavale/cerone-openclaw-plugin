function deriveReason(response, event) {
    const firstViolation = response.violations?.find((entry) => typeof entry === "string" && entry.trim());
    if (firstViolation) {
        return firstViolation;
    }
    return `Cerone flagged ${event.toolName}`;
}
export function mapValidationResult(params) {
    const { config, event, response, pluginId } = params;
    const reason = deriveReason(response, event);
    if (response.trial_stoploss) {
        return {
            block: true,
            blockReason: "Trial limit reached",
        };
    }
    if (response.result === "approved") {
        return undefined;
    }
    if (response.result === "rejected") {
        return {
            block: true,
            blockReason: reason,
        };
    }
    if (config.flaggedBehavior === "allow") {
        return undefined;
    }
    if (config.flaggedBehavior === "block") {
        return {
            block: true,
            blockReason: reason,
        };
    }
    return {
        requireApproval: {
            title: `Cerone flagged ${event.toolName}`,
            description: reason,
            severity: "warning",
            timeoutMs: config.approvalTimeoutMs,
            timeoutBehavior: "deny",
            pluginId,
            onResolution: params.onResolution,
        },
    };
}
