配额侧边栏会在 Paseo 侧边栏底部常驻展示各模型账号的配额摘要、Antigravity 多账号额度、DeepSeek 开放平台余额、OpenCode Go 订阅配额、OpenCode 本地收费花费统计以及 Pi Coding Agent 状态，并配有完整详情页、四种语言切换、侧边栏底部一键收起/展开按钮以及逐项显示隐藏管理。

## 工作原理

本插件注册了侧边栏底部摘要区块、详情页、插件设置页与 Command Center 快捷入口。桌面端和移动端通过 TanStack Query 自动轮询并共享缓存，详情页支持一键手动刷新。

- **Paseo 原生内置账号配额**：Codex、Claude、GitHub Copilot、Cursor、Kimi、MiniMax、Z.AI、Grok 等内置配额源直接通过 Paseo SDK（`providers.listUsage()`）读取。
  - 当 Paseo 未上报内置 Claude 配额报告时，插件会展示明确的 **未发现 Claude 配额报告** 状态（可像其他内置源一样自由显示或隐藏），说明 Claude Pro/Max OAuth 订阅配额来自 Paseo 内置 OAuth 源，而按量计费的 `ANTHROPIC_API_KEY` 不提供订阅配额窗口；本插件不会额外扫描本机 Claude 凭据，也不会伪造额度。
- **Antigravity 多账号配额与 AI Credits**：自动发现 Paseo `config.json` 中的 `antigravity` 及所有启用的 `agy ... acp` provider 配置（支持 `--gemini-dir` / `--app-data-dir` 独立目录与各自环境变量如代理设置），按账号由 daemon 子进程调用本机 `agy` CLI（`agy -p "/usage" --output-format json` 与 `agy -p "/credits" --output-format json`）。结果按账号在服务端缓存 2 分钟，手动刷新时立即实时重查；该命令不创建会话、不消耗模型 Token。
- **Pi Coding Agent 状态与 OpenRouter 余额**：读取 `~/.pi/agent/auth.json`（或 `$PI_CODING_AGENT_DIR/auth.json`）中的 Provider 列表与认证类型（OAuth / API Key），标注已被 Paseo 内置 Claude / Codex / Copilot 覆盖的 OAuth 登录，展示 Paseo 活跃 Pi 会话消耗，并支持可选查询 OpenRouter 余额（`GET https://openrouter.ai/api/v1/credits`）。当未找到 Pi 凭证文件时，详情页显示 **未配置**，侧边栏自动隐藏 Pi 行。
- **DeepSeek 开放平台余额**：由服务端请求 `GET https://api.deepseek.com/user/balance`。
- **OpenCode Go 订阅窗口**：由服务端请求 `GET https://opencode.ai/zen/go/v1/usage`。
- **普通 OpenCode 本地花费统计**：通过 `opencode stats --days 0 --cost --models --json`、`opencode stats --days 7 --cost --models --json` 与 `opencode auth list` 读取；免费模型（`opencode/*-free`）默认隐藏，仅展示 BYOK 收费模型的已花费估算，可随时切换显示。

## 配置说明

需要 Paseo `>=0.16.0-beta.2` 并在目标 daemon 上启用插件。Paseo 原生内置配额源以及本机已配置的 `agy`、`opencode` 与 Pi 状态检查可自动工作。

### 语言设置

在 **Settings → Plugins → Usage Sidebar** 中可按设备选择以下四种语言模式，并统一应用于侧边栏、详情页与设置页三个入口：

- **跟随 Paseo 应用语言**（默认）
- **跟随系统语言**
- **English**
- **简体中文**

### DeepSeek API 余额

DeepSeek Harness（`dsh`）账号登录态暂无公开的余额查询接口。如需展示 DeepSeek 开放平台余额，可在 daemon 所在主机按以下任一方式配置（按顺序优先）：

1. 在 daemon 环境中设置环境变量 `DEEPSEEK_API_KEY`。
2. 创建 `~/.paseo/usage-sidebar.json` 并写入 `{ "deepseekApiKey": "sk-your-key" }`。
3. 可选开启：在插件设置中分别开启 **复用本机 OpenCode 已存凭证** 读取 OpenCode 中的 DeepSeek Key，或开启 **复用本机 Pi 已存凭证** 读取 `~/.pi/agent/auth.json` 中的 `deepseek` Key；两个开关相互独立且默认关闭。

### OpenCode Go 配额

如需展示 OpenCode Go 订阅窗口，可按以下任一方式配置（按顺序优先）：

1. 设置环境变量 `OPENCODE_GO_API_KEY`。
2. 在 `~/.paseo/usage-sidebar.json` 中写入 `"opencodeGoApiKey"`。
3. 可选开启：在插件设置中开启 **复用本机 OpenCode 已存凭证** 读取 OpenCode v1/v2 中的 `opencode-go` 密钥，或开启 **复用本机 Pi 已存凭证** 读取 `~/.pi/agent/auth.json` 中的 `opencode-go` 密钥。

### Pi OpenRouter 余额

当 `~/.pi/agent/auth.json` 中存在 `openrouter` 配置时，可在插件设置中开启 **复用本机 Pi 已存凭证（可选）**，通过 `https://openrouter.ai/api/v1/credits` 查询剩余余额；该开关关闭时不发起任何基于 Pi 密钥的认证请求。

### 侧边栏收起与自定义显示项

- 点击侧边栏最底部的 **隐藏配额** / **显示配额** 按钮，可按当前设备一键收起或展开整个配额区块。
- 在详情页点击任意卡片右上角的 **隐藏** 可立刻隐藏不需要的项（如 Claude、GitHub Copilot、OpenCode Go 或 Pi），也可在 **Settings → Plugins → Usage Sidebar** 统一管理所有显示开关。
- 在 OpenCode 卡片右上角或插件设置中可随时开关免费模型统计。

## 数据访问与隐私

- 内置账号配额（含 Codex 与 Claude）及会话 Token 汇总仅在 Paseo daemon 连接内流转；插件不会额外扫描或读取本机 Claude 凭据。
- 配置后的 DeepSeek、OpenCode Go 与 OpenRouter 密钥仅在 daemon 子进程内存中读取，只通过 `Authorization` 请求头发送给 `https://api.deepseek.com/user/balance`、`https://opencode.ai/zen/go/v1/usage` 与 `https://openrouter.ai/api/v1/credits`。
- **复用本机 OpenCode 已存凭证** 与 **复用本机 Pi 已存凭证** 为彼此独立的开关，默认均关闭；从旧版本升级不会自动开启 Pi 凭据复用。Pi 凭据复用关闭时，不会使用 Pi 密钥发起任何认证调用（包括 OpenRouter 以及 DeepSeek / OpenCode Go 的 Pi fallback）。
- 调用本机 `agy` 和 `opencode` 均使用固定参数数组，无 shell 拼接；凭据、请求头、原始 CLI 凭证输出和完整用量 JSON 绝不写入日志。
- 显示项与凭据复用开关按主机持久化同步；侧边栏收起状态与插件语言选择按设备独立保存。

## 已知限制

- Paseo `0.16.0-beta.2` 的 `providers.listUsage()` 返回 daemon 侧缓存（最长 5 分钟），暂未提供客户端强制刷新参数。
- Antigravity 配额查询依赖本机已登录的 `agy` CLI 配置，自动轮询按账号采用 2 分钟服务端缓存；接口返回缺失或 epoch 哨兵重置时间时自动忽略，不再误报为即将重置。
- 普通 OpenCode 展示的美元金额为按本地 Token 推算的已花费估算，不是上游账号剩余余额；OpenCode 免费模型无公开剩余额度接口。
- DeepSeek Harness（`dsh`）账号登录态与按量计费的 Anthropic API Key 均不提供订阅配额窗口。
