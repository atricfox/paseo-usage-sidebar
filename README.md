# Paseo Usage Sidebar

A trusted local [Paseo](https://paseo.sh) plugin that displays provider account quotas, multi-account Antigravity limits, DeepSeek Open Platform balance, OpenCode Go subscription windows, OpenCode local paid spend, and Pi Coding Agent status directly in the sidebar footer, paired with a full detail screen, per-device language selection, per-item visibility controls, and a one-click sidebar collapse button.

## Features

- **Sidebar footer summary**: compact rows showing remaining percentages, balances, spend, and reset countdowns, plus a bottom **Hide quotas / Show quotas** toggle persisted per device.
- **Full detail screen**: progress bars, quota windows, balances, reset times, account metadata, manual refresh, and automatic TanStack Query polling.
- **Native Paseo built-in usage reports**: reads Codex, Claude, GitHub Copilot, Cursor, Kimi, MiniMax, Z.AI, Grok, and other built-in Paseo usage sources via `usePaseo().providers.listUsage()`.
  - **Claude visibility & honest fallback**: relies strictly on Paseo's built-in Claude OAuth quota report (never scans local Claude credentials or fabricates quotas). When no built-in Claude report is discovered, shows an explicit **No Claude quota report** state explaining the difference between Claude Pro/Max OAuth subscription quotas and pay-as-you-go `ANTHROPIC_API_KEY` usage, along with observed Paseo Claude session tokens when available.
- **Multi-account Antigravity quotas & AI credits**: discovers `antigravity` and every enabled `agy ... acp` provider profile in Paseo's `config.json` (honoring custom `--gemini-dir` / `--app-data-dir` stores and provider `env`), querying `agy -p "/usage" --output-format json` and `agy -p "/credits" --output-format json` (zero turns, zero conversations created, 2-minute daemon cache per account, live refresh on demand).
- **Pi Coding Agent status & OpenRouter credits**: inspects `~/.pi/agent/auth.json` (or `$PI_CODING_AGENT_DIR/auth.json`) for configured provider names and auth types (`OAuth` vs `API key`), notes OAuth logins already covered by Paseo built-in Claude/Codex/Copilot quotas, displays active Paseo Pi session tokens/cost, and optionally queries OpenRouter credits. When no Pi auth store is found, the detail card shows **Not configured** and the sidebar hides the Pi row automatically.
- **DeepSeek Open Platform balance**: daemon-side RPC querying `https://api.deepseek.com/user/balance` via `DEEPSEEK_API_KEY`, `~/.paseo/usage-sidebar.json`, or optional opt-in reuse of local OpenCode or Pi credentials.
- **OpenCode Go & OpenCode local spend**: supports OpenCode Go quota windows (`https://opencode.ai/zen/go/v1/usage`) and local `opencode stats` spend tracking with free-tier models (`opencode/*-free`) hidden by default and toggleable on demand.
- **Independent opt-in credential reuse**: separate, default-off switches for **Reuse stored OpenCode credentials** and **Reuse stored Pi credentials**. Keeping the Pi toggle off guarantees zero authenticated API calls using Pi keys (DeepSeek Pi fallback, OpenCode Go Pi fallback, and OpenRouter credits).
- **Four-mode language selector**: choose **Follow Paseo app**, **Follow system language**, **English**, or **简体中文** per device in plugin settings, applied consistently across the sidebar footer, detail screen, and settings screen.
- **Cross-platform**: pure React Native primitives and `theme.colors` tokens for desktop, web, iOS, and Android.

## Installation

Enable plugins in your Paseo daemon (**Settings → Plugins → Enable plugins**), then install `v0.2.0` from GitHub:

```bash
paseo plugin add git:atricfox/paseo-usage-sidebar --ref v0.2.0
```

Or install from a local checkout:

```bash
paseo plugin install /absolute/path/to/paseo-usage-sidebar
```

## Configuration

### DeepSeek & OpenCode Go keys (optional)

Set environment variables on the daemon host (`DEEPSEEK_API_KEY`, `OPENCODE_GO_API_KEY`), or create `~/.paseo/usage-sidebar.json`:

```json
{
  "deepseekApiKey": "sk-your-deepseek-key",
  "opencodeGoApiKey": "your-opencode-go-key"
}
```

Alternatively, enable either opt-in switch in **Settings → Plugins → Usage Sidebar**:

- **Reuse stored OpenCode credentials (opt-in)**: reads DeepSeek or OpenCode Go keys from local OpenCode auth in daemon memory only.
- **Reuse stored Pi credentials (opt-in)**: independent from OpenCode and off by default; reads DeepSeek, OpenCode Go, or OpenRouter API keys from `~/.pi/agent/auth.json` in daemon memory only.

### Language, visibility & free-model filtering

- Select **Follow Paseo app**, **Follow system language**, **English**, or **简体中文** in **Settings → Plugins → Usage Sidebar** (saved per device).
- Collapse or expand the entire sidebar footer block with the bottom **Hide quotas / Show quotas** row.
- Hide individual built-in providers (such as Claude or GitHub Copilot) or extended sources (including Pi and Antigravity) from any card header or from **Settings → Plugins → Usage Sidebar**.
- Toggle OpenCode free models on or off directly from the OpenCode card or plugin settings.

## Development

```bash
npm install
npm run typecheck
```

## License

[MIT](./LICENSE)
