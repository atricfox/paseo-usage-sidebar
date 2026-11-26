# Paseo Usage Sidebar

A trusted local [Paseo](https://paseo.sh) plugin that displays provider account quotas, Antigravity model limits, DeepSeek Open Platform balance, OpenCode Go subscription windows, and OpenCode local paid spend directly in the sidebar footer, with a full detail screen, per-item hide/show controls, and a one-click sidebar collapse button.

## Features

- **Sidebar footer summary**: compact rows showing remaining percentages, balances, spend, and reset countdowns, plus a bottom **Hide quotas / Show quotas** toggle persisted per device.
- **Full detail screen**: progress bars, quota windows, balances, reset times, account metadata, manual refresh, and 60-second TanStack Query polling.
- **Built-in Paseo usage sources**: reads Codex, GitHub Copilot, Claude, Cursor, Kimi, MiniMax, Z.AI, Grok, and any other installed Paseo usage source via `usePaseo().providers.listUsage()`.
- **Antigravity quotas & AI credits**: queries `agy -p "/usage" --output-format json` and `agy -p "/credits" --output-format json` (zero turns, zero conversations created, 2-minute daemon cache, live refresh on demand) while inheriting Paseo's configured `antigravity` provider environment.
- **DeepSeek Open Platform balance**: daemon-side RPC querying `https://api.deepseek.com/user/balance` via `DEEPSEEK_API_KEY`, `~/.paseo/usage-sidebar.json`, or optional opt-in reuse of local OpenCode credentials.
- **OpenCode Go & OpenCode local spend**: supports OpenCode Go quota windows (`https://opencode.ai/zen/go/v1/usage`) and local `opencode stats` spend tracking with free-tier models (`opencode/*-free`) hidden by default and toggleable on demand.
- **Bilingual UI (English & Simplified Chinese)**: follows Paseo's active app language dynamically via `defineTranslations` / `useTranslation`.
- **Cross-platform**: pure React Native primitives and `theme.colors` tokens for desktop, web, iOS, and Android.

## Installation

Enable plugins in your Paseo daemon (**Settings → Plugins → Enable plugins**), then install directly from GitHub:

```bash
paseo plugin add git:atricfox/paseo-usage-sidebar
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

Alternatively, enable **Reuse stored OpenCode credentials (opt-in)** in **Settings → Plugins → Usage Sidebar**.

### Visibility & free-model filtering

- Collapse or expand the entire sidebar footer block with the bottom **Hide quotas / Show quotas** row.
- Hide individual built-in providers (such as GitHub Copilot) or extended sources from any card header or from **Settings → Plugins → Usage Sidebar**.
- Toggle OpenCode free models on or off directly from the OpenCode card or plugin settings.

## Development

```bash
npm install
npm run typecheck
```

## License

[MIT](./LICENSE)
