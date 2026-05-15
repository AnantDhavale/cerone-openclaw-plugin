
# cerone-openclaw-plugin

A native OpenClaw plugin that validates tool calls with **Cerone** through OpenClaw's `before_tool_call` hook, before execution.

No core patching. Uses the public plugin SDK and OpenClaw's built-in plugin approval flow.

---

## Acknowledgment

I am grateful to the OpenClaw creators and maintainers for building and open-sourcing the plugin system that makes integrations like this possible.

---

## Install

From npm:

```bash
openclaw plugins install cerone-openclaw-plugin
```

Local source checkout:

```bash
npm install
npm run build
openclaw plugins install ./path/to/cerone-openclaw-plugin
```

Linked local development install:

```bash
openclaw plugins install --link ./path/to/cerone-openclaw-plugin
```

After install, enable the plugin and configure it in `openclaw.json`.

---

## Behavior

| Cerone response | OpenClaw action |
|---|---|
| `approved` | Allow the tool call |
| `flagged` | Require OpenClaw approval by default |
| `rejected` | Block the tool call |
| Timeout / network failure / `5xx` | Fail open by default, configurable via `networkFailureBehavior` |
| `trial_warning: true` | Log a warning |
| `trial_stoploss: true` | Block with `Trial limit reached` |

---

## Cerone-Aligned Flow

This plugin is aligned to the current hosted Cerone runtime shape:

1. If `apiKey` is configured, use it.
2. If `apiKey` is omitted and `trialMode` is `auto`, request a hosted trial token.
3. Auto-register a Cerone agent once.
4. Persist the resulting `agent_id` and trial token by default.
5. Call `POST /v1/validate` on every `before_tool_call`.

---

## Data Handling

This plugin sends tool invocation data to the Cerone API at runtime for validation.

Depending on how your OpenClaw tools are defined, that runtime data may include:

- tool names
- tool parameters
- file paths
- URLs
- prompts or query text
- session or run metadata you choose to include

Do not use this plugin with sensitive or regulated data unless your organization
has approved that data flow. Avoid passing secrets or unnecessary sensitive
payloads in tool parameters where possible.

See [PRIVACY.md](./PRIVACY.md) for the free-trial data handling policy.

---

## OpenClaw Configuration

Plugin runtime config belongs under `plugins.entries.<plugin-id>.config`.
`enabled` stays on the plugin entry, not inside plugin config.

```json
{
  "plugins": {
    "entries": {
      "cerone-openclaw-plugin": {
        "enabled": true,
        "config": {
          "baseUrl": "https://aztp-homer-semantics.onrender.com",
          "timeoutMs": 1000,
          "flaggedBehavior": "requireApproval",
          "networkFailureBehavior": "allow",
          "approvalTimeoutMs": 120000,
          "includeContext": true,
          "includeDerivedPaths": true,
          "trialMode": "auto",
          "autoRegisterAgent": true,
          "persistAgentId": true,
          "agentPurpose": "Read repository files and inspect code inside OpenClaw for software engineering tasks.",
          "agentCapabilities": [
            "file_read",
            "file_write",
            "network_access",
            "api_call"
          ]
        }
      }
    }
  }
}
```

---

## Config Fields

- `apiKey`: optional provisioned Cerone key.
- `baseUrl`: Cerone base URL. Defaults to `https://aztp-homer-semantics.onrender.com`.
- `timeoutMs`: HTTP timeout for Cerone validation calls.
- `flaggedBehavior`: `requireApproval | allow | block`.
- `networkFailureBehavior`: `allow | block`.
- `approvalTimeoutMs`: OpenClaw plugin approval timeout.
- `includeContext`: include OpenClaw run metadata in `action.context`.
- `includeDerivedPaths`: include `event.derivedPaths` when available.
- `trialMode`: `auto | off`.
- `autoRegisterAgent`: create a Cerone agent automatically when needed.
- `persistAgentId`: persist trial token and Cerone `agent_id`.
- `agentPurpose`: required when the plugin needs to auto-register a Cerone agent.
- `agentCapabilities`: required when the plugin needs to auto-register a Cerone agent.
- `agentEnvironment`: `development | staging | production`.
- `stateFilePath`: optional override for persisted plugin state.

---

## Example: Governed X/Twitter Actions

Cerone is useful when an OpenClaw workspace has tools that can publish or change public state. For example, pair this plugin with [TweetClaw](https://github.com/Xquik-dev/tweetclaw) when an agent can search tweets, search tweet replies, post tweets, post tweet replies, export followers, look up users, upload or download media, send direct messages, monitor tweets, deliver webhooks, or run giveaway draws.

Install TweetClaw separately:

```bash
openclaw plugins install @xquik/tweetclaw
openclaw config set tools.alsoAllow '["explore", "tweetclaw"]'
```

Then describe the social-media capability in Cerone's agent registration fields:

```json
{
  "plugins": {
    "entries": {
      "cerone-openclaw-plugin": {
        "enabled": true,
        "config": {
          "flaggedBehavior": "requireApproval",
          "networkFailureBehavior": "block",
          "agentPurpose": "Use OpenClaw tools for repository work and approval-gated X/Twitter automation.",
          "agentCapabilities": [
            "file_read",
            "file_write",
            "api_call",
            "tweet_search",
            "tweet_write_requires_approval"
          ]
        }
      }
    }
  }
}
```

Keep the Xquik API key in TweetClaw's local OpenClaw config, not in chat messages or Cerone prompts. With `flaggedBehavior` set to `requireApproval`, Cerone can return an approval decision before OpenClaw executes high-risk `tweetclaw` calls.

---

## Cerone Request Mapping

The plugin sends:

```json
{
  "agent_id": "agt_...",
  "action": {
    "tool": "file_write",
    "parameters": {},
    "context": {
      "source": "openclaw",
      "sessionKey": "optional",
      "sessionId": "optional",
      "runId": "optional",
      "channelId": "optional",
      "toolCallId": "optional",
      "derivedPaths": []
    }
  },
  "blocking": true,
  "timeout_ms": 1000
}
```

---

## OpenClaw Mapping

- `approved` -> return `undefined`
- `flagged` -> return `requireApproval` by default
- `rejected` -> return `{ block: true, blockReason }`

---

## Trial Token

If you want to try Cerone without a provisioned key, the plugin can bootstrap a hosted trial automatically.

You can also get the Cerone Python package separately:

```bash
pip install cerone
```

The current AZTP-aligned path for this plugin is hosted trial bootstrap, not a local CLI bootstrap requirement.

---

## Notes

- This MVP does not rewrite `event.params`.
- It does not require OpenClaw core changes.
- It intentionally uses only `before_tool_call`.
- It does not implement post-tool-call reporting or audit UI.
- The runtime does not invent fallback capabilities or a fallback agent purpose. If `autoRegisterAgent` is enabled and no persisted `agent_id` exists, provide a real `agentPurpose` and `agentCapabilities`.

---

## License

See [LICENSE](./LICENSE) for details.

Any errors, please hit me up : anantdhavale@gmail.com

I am working on patching the incorrect rejection as I write this comment. Also working on broadening the semantic alignment. 
