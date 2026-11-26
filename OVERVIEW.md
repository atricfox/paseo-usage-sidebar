Usage Sidebar displays provider account quota summaries, multi-account Antigravity limits, DeepSeek Open Platform balance, OpenCode Go subscription windows, OpenCode local paid spend, and Pi Coding Agent status directly in the Paseo sidebar footer, paired with a full detail screen, a four-mode language selector, a one-click sidebar collapse button, and per-item visibility controls.

## How it works

The plugin registers a compact footer section in the sidebar, a detail screen, a plugin settings screen, and Command Center shortcuts. Both desktop and mobile clients share TanStack Query caches that poll automatically, and the detail screen includes a manual refresh button.

- **Built-in Paseo usage reports**: Codex, Claude, GitHub Copilot, Cursor, Kimi, MiniMax, Z.AI, Grok, and other built-in sources are read directly through Paseo's native `providers.listUsage()` API.
  - When Paseo does not report a built-in Claude quota, the plugin displays a **No Claude quota report** state (configurable/hideable like any built-in source) explaining that Claude Pro/Max OAuth subscription quotas come from Paseo's built-in OAuth source while pay-as-you-go `ANTHROPIC_API_KEY` credentials do not expose subscription quota windows. It never scans local Claude credentials or fabricates quota figures.
- **Multi-account Antigravity**: discovers `antigravity` and all enabled `agy ... acp` profiles defined in Paseo's `config.json` (including custom `--gemini-dir` / `--app-data-dir` stores and per-profile environment variables such as proxy settings). Queries `agy -p "/usage" --output-format json` and `agy -p "/credits" --output-format json` per account with a 2-minute daemon cache and live manual refresh. These commands create no conversations and consume no model tokens.
- **Pi Coding Agent**: reads provider metadata (provider ID and auth type: OAuth vs API key) from `~/.pi/agent/auth.json` (or `$PI_CODING_AGENT_DIR/auth.json`), highlights OAuth logins tracked by Paseo's built-in Claude/Codex/Copilot quotas, surfaces active Paseo Pi session token usage, and optionally queries OpenRouter credits (`GET https://openrouter.ai/api/v1/credits`). When no Pi auth store is present, the detail card shows **Not configured** and the sidebar hides the Pi row automatically.
- **DeepSeek Open Platform balance**: queried by the daemon subprocess via `GET https://api.deepseek.com/user/balance`.
- **OpenCode Go subscription windows**: queried by the daemon subprocess via `GET https://opencode.ai/zen/go/v1/usage`.
- **OpenCode local spend**: read via `opencode stats --days 0 --cost --models --json`, `opencode stats --days 7 --cost --models --json`, and `opencode auth list`. Free-tier models (`opencode/*-free`) are hidden by default so only paid BYOK model spend is shown, and can be toggled on at any time.

## Setup

Requires Paseo `>=0.16.0-beta.2` with plugins enabled on the target daemon. Native Paseo usage sources and local `agy` / `opencode` / Pi status inspection work automatically when those tools are configured on the daemon host.

### Language

In **Settings → Plugins → Usage Sidebar**, choose one of four per-device language options applied across the sidebar footer, detail screen, and settings screen:

- **Follow Paseo app** (default)
- **Follow system language**
- **English**
- **简体中文**

### DeepSeek API balance

DeepSeek Harness (`dsh`) account sign-in has no public balance API. To show your DeepSeek Open Platform balance, provide an API key on the daemon host using one of these methods (checked in order):

1. Set the `DEEPSEEK_API_KEY` environment variable in the daemon environment.
2. Create `~/.paseo/usage-sidebar.json` with `{ "deepseekApiKey": "sk-your-key" }`.
3. Optional opt-in: enable **Reuse stored OpenCode credentials** to read an existing DeepSeek key from local OpenCode auth, or enable **Reuse stored Pi credentials** to read a `deepseek` API key from `~/.pi/agent/auth.json`. Both switches are independent and off by default.

### OpenCode Go

To show OpenCode Go subscription windows, provide an OpenCode Go key using one of these methods (checked in order):

1. Set the `OPENCODE_GO_API_KEY` environment variable.
2. Add `"opencodeGoApiKey"` to `~/.paseo/usage-sidebar.json`.
3. Optional opt-in: enable **Reuse stored OpenCode credentials** to read an `opencode-go` key from OpenCode v1/v2 auth, or enable **Reuse stored Pi credentials** to read an `opencode-go` key from `~/.pi/agent/auth.json`.

### Pi OpenRouter credits

When an `openrouter` entry is present in `~/.pi/agent/auth.json`, enable **Reuse stored Pi credentials (opt-in)** in plugin settings to query remaining credits via `https://openrouter.ai/api/v1/credits`. While this switch is off, no authenticated request is sent using Pi credentials.

### Sidebar collapse and item visibility

- Click **Hide quotas** / **Show quotas** at the bottom of the sidebar footer to collapse or expand the entire quota block on the current device.
- Click **Hide** on any card in the detail screen to remove unwanted sources (such as Claude, GitHub Copilot, OpenCode Go, or Pi) from both the sidebar and list, or manage every toggle under **Settings → Plugins → Usage Sidebar**.
- Toggle **Show free** / **Hide free** on the OpenCode card (or in settings) to include or exclude OpenCode free-tier models.

## Data access and privacy

- Built-in provider usage (including Codex and Claude) and agent token counts stay inside Paseo's daemon connection. The plugin never scans local Claude credentials.
- When configured, DeepSeek, OpenCode Go, and OpenRouter API keys are read only in daemon memory and sent only in the `Authorization` header to `https://api.deepseek.com/user/balance`, `https://opencode.ai/zen/go/v1/usage`, and `https://openrouter.ai/api/v1/credits`.
- **Reuse stored OpenCode credentials** and **Reuse stored Pi credentials** are separate toggles, both disabled by default. Upgrading from an earlier OpenCode setting never enables Pi credential reuse automatically. When Pi credential reuse is off, no authenticated calls are made with Pi keys (neither OpenRouter nor DeepSeek / OpenCode Go Pi fallbacks).
- Local CLI commands (`agy` and `opencode`) run with fixed arguments and no shell interpolation. Credentials, raw headers, CLI credential output, and full usage payloads are never written to plugin logs.
- Display visibility and credential opt-in settings are stored per host; the sidebar collapsed state and plugin language preference are stored per device.

## Known limits

- `providers.listUsage()` in Paseo `0.16.0-beta.2` serves the daemon's cached usage reports (up to 5 minutes) and does not expose a client-side force-refresh option.
- Antigravity quota checks require signed-in local `agy` profile(s) and run with a 2-minute daemon cache per account between automatic refreshes. Missing or epoch sentinel reset timestamps are omitted rather than shown as imminent resets.
- Ordinary OpenCode dollar amounts are estimated local spend calculated from token usage, not remaining upstream account balances. Free-tier OpenCode models have no published remaining-quota API.
- DeepSeek Harness (`dsh`) consumer account login and pay-as-you-go Anthropic API keys do not expose subscription quota windows.
