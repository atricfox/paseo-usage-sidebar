Usage Sidebar shows provider account quota summaries, DeepSeek Open Platform balance, OpenCode Go subscription windows, OpenCode local paid spend, and Antigravity model quotas directly in the Paseo sidebar footer, paired with a full detail screen, a one-click sidebar collapse button, and per-item visibility controls.

## How it works

The plugin registers a compact footer section in the sidebar, a detail screen, a plugin settings screen, and Command Center shortcuts. Both desktop and mobile clients share TanStack Query caches that poll automatically, and the detail screen includes a manual refresh button. The UI follows the Paseo app language in English and Simplified Chinese.

- Built-in provider quotas (such as Codex, GitHub Copilot, Claude, Cursor, Kimi, MiniMax, Z.AI, and Grok) are read through the Paseo SDK (`providers.listUsage()`).
- Antigravity model quotas and AI credits are read by the daemon subprocess using the local `agy` CLI (`agy -p "/usage" --output-format json` and `agy -p "/credits" --output-format json`), reusing the `antigravity` provider environment configured in Paseo (such as proxy variables). Results are cached on the daemon for 2 minutes and refreshed immediately on manual refresh. These commands create no conversations and consume no model tokens.
- DeepSeek Open Platform balance is queried by the daemon subprocess via `GET https://api.deepseek.com/user/balance`.
- OpenCode Go subscription windows are queried by the daemon subprocess via `GET https://opencode.ai/zen/go/v1/usage`.
- Ordinary OpenCode local spend statistics are read via `opencode stats --days 0 --cost --models --json`, `opencode stats --days 7 --cost --models --json`, and `opencode auth list`. Free-tier models (`opencode/*-free`) are hidden by default so only paid BYOK model spend is shown, and can be toggled on at any time.

## Setup

Requires Paseo `>=0.16.0-beta.2` with plugins enabled on the target daemon. Built-in Paseo usage sources and local `agy` / `opencode` CLI stats work automatically when those tools are installed and signed in on the daemon host.

### DeepSeek API balance

DeepSeek Harness (`dsh`) account sign-in has no public balance API. To show your DeepSeek Open Platform balance, provide an API key on the daemon host using one of these methods (checked in order):

1. Set the `DEEPSEEK_API_KEY` environment variable in the daemon environment.
2. Create `~/.paseo/usage-sidebar.json` with `{ "deepseekApiKey": "sk-your-key" }`.
3. Optional opt-in: enable "Reuse stored OpenCode credentials" in Settings -> Plugins -> Usage Sidebar to read an existing DeepSeek key from local OpenCode auth. This option is off by default.

### OpenCode Go

To show OpenCode Go subscription windows, provide an OpenCode Go key using one of these methods (checked in order):

1. Set the `OPENCODE_GO_API_KEY` environment variable.
2. Add `"opencodeGoApiKey"` to `~/.paseo/usage-sidebar.json`.
3. Optional opt-in: enable "Reuse stored OpenCode credentials" in plugin settings to read an existing `opencode-go` key from `~/.local/share/opencode/auth.json` (OpenCode v1) or `opencode auth export` (OpenCode v2).

### Sidebar collapse and item visibility

- Click **Hide quotas** / **Show quotas** at the bottom of the sidebar footer to collapse or expand the entire quota block on the current device.
- Click **Hide** on any card in the detail screen to remove unwanted sources (such as GitHub Copilot or OpenCode Go) from both the sidebar and list, or manage every toggle under Settings -> Plugins -> Usage Sidebar.
- Toggle **Show free** / **Hide free** on the OpenCode card (or in settings) to include or exclude OpenCode free-tier models.

## Data access and privacy

- Built-in provider usage and agent token counts stay inside Paseo's daemon connection.
- When configured, DeepSeek and OpenCode Go API keys are read only in daemon memory and sent only in the `Authorization` header to `https://api.deepseek.com/user/balance` and `https://opencode.ai/zen/go/v1/usage`.
- Reading local OpenCode credentials (`~/.local/share/opencode/auth.json` or `opencode auth export`) is disabled by default and runs only when explicitly enabled in plugin settings.
- Local CLI commands (`agy` and `opencode`) run with fixed arguments and no shell interpolation. Credentials, raw headers, CLI credential output, and full usage payloads are never written to plugin logs.
- Display visibility settings are stored per host; the sidebar collapsed state is stored per device.

## Known limits

- `providers.listUsage()` in Paseo `0.16.0-beta.2` serves the daemon's cached usage reports (up to 5 minutes) and does not expose a client-side force-refresh option.
- Antigravity quota checks require a signed-in local `agy` CLI and run with a 2-minute daemon cache between automatic refreshes.
- Ordinary OpenCode dollar amounts are estimated local spend calculated from token usage, not remaining upstream account balances. Free-tier OpenCode models have no published remaining-quota API.
- DeepSeek Harness (`dsh`) consumer account login does not expose a public quota API; DeepSeek balance reflects the Open Platform API key you configure.
