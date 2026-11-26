配额侧边栏会在 Paseo 侧边栏底部常驻展示各模型账号的配额摘要、DeepSeek 开放平台余额、OpenCode Go 订阅配额、OpenCode 本地收费花费统计以及 Antigravity 模型配额，并配有完整详情页、侧边栏底部一键收起/展开按钮以及逐项显示隐藏管理。

## 工作原理

本插件注册了侧边栏底部摘要区块、详情页、插件设置页与 Command Center 快捷入口。桌面端和移动端通过 TanStack Query 自动轮询并共享缓存，详情页支持一键手动刷新。界面随 Paseo 应用语言自动切换英文与简体中文。

- Paseo 内置账号配额（如 Codex、GitHub Copilot、Claude、Cursor、Kimi、MiniMax、Z.AI、Grok）直接通过 Paseo SDK（`providers.listUsage()`）读取。
- Antigravity 模型配额与 AI Credits 由 daemon 子进程调用本机 `agy` CLI（`agy -p "/usage" --output-format json` 与 `agy -p "/credits" --output-format json`）获取，自动沿用 Paseo 中 `antigravity` provider 的环境变量（如代理配置）。结果在服务端缓存 2 分钟，手动刷新时立即实时重查；该命令不创建会话、不消耗模型 Token。
- DeepSeek 开放平台余额由服务端请求 `GET https://api.deepseek.com/user/balance`。
- OpenCode Go 订阅窗口由服务端请求 `GET https://opencode.ai/zen/go/v1/usage`。
- 普通 OpenCode 本地花费统计通过 `opencode stats --days 0 --cost --models --json`、`opencode stats --days 7 --cost --models --json` 与 `opencode auth list` 读取；免费模型（`opencode/*-free`）默认隐藏，仅展示 BYOK 收费模型的已花费估算，可随时切换显示。

## 配置说明

需要 Paseo `>=0.16.0-beta.2` 并在目标 daemon 上启用插件。Paseo 内置配额源以及本机已登录的 `agy`、`opencode` 统计无需额外配置。

### DeepSeek API 余额

DeepSeek Harness（`dsh`）账号登录态暂无公开的余额查询接口。如需展示 DeepSeek 开放平台余额，可在 daemon 所在主机按以下任一方式配置（按顺序优先）：

1. 在 daemon 环境中设置环境变量 `DEEPSEEK_API_KEY`。
2. 创建 `~/.paseo/usage-sidebar.json` 并写入 `{ "deepseekApiKey": "sk-your-key" }`。
3. 可选开启：在 Settings -> Plugins -> Usage Sidebar 中手动开启「复用本机 OpenCode 已存凭证」，以读取本机 OpenCode 中的 DeepSeek Key（默认关闭）。

### OpenCode Go 配额

如需展示 OpenCode Go 订阅窗口，可按以下任一方式配置（按顺序优先）：

1. 设置环境变量 `OPENCODE_GO_API_KEY`。
2. 在 `~/.paseo/usage-sidebar.json` 中写入 `"opencodeGoApiKey"`。
3. 可选开启：在插件设置中开启「复用本机 OpenCode 已存凭证」，以读取 `~/.local/share/opencode/auth.json`（OpenCode v1）或 `opencode auth export`（OpenCode v2）中的 `opencode-go` 密钥。

### 侧边栏收起与自定义显示项

- 点击侧边栏最底部的 **隐藏配额** / **显示配额** 按钮，可按当前设备一键收起或展开整个配额区块。
- 在详情页点击任意卡片右上角的 **隐藏** 可立刻隐藏不需要的项（如 GitHub Copilot 或 OpenCode Go），也可在 Settings -> Plugins -> Usage Sidebar 统一管理所有显示开关。
- 在 OpenCode 卡片右上角或插件设置中可随时开关免费模型统计。

## 数据访问与隐私

- 内置账号配额和会话 Token 汇总仅在 Paseo daemon 连接内流转。
- 配置后的 DeepSeek 和 OpenCode Go 密钥仅在 daemon 子进程内存中读取，只通过 `Authorization` 请求头发送给 `https://api.deepseek.com/user/balance` 和 `https://opencode.ai/zen/go/v1/usage`。
- 读取本机 OpenCode 凭证默认关闭，仅在用户在插件设置中主动开启后才会执行。
- 调用本机 `agy` 和 `opencode` 均使用固定参数数组，无 shell 拼接；凭据、请求头、原始 CLI 凭证输出和完整用量 JSON 绝不写入日志。
- 显示项开关按主机持久化同步；侧边栏收起状态按设备独立保存。

## 已知限制

- Paseo `0.16.0-beta.2` 的 `providers.listUsage()` 返回 daemon 侧缓存（最长 5 分钟），暂未提供客户端强制刷新参数。
- Antigravity 配额查询依赖本机已登录的 `agy` CLI，自动轮询采用 2 分钟服务端缓存。
- 普通 OpenCode 展示的美元金额为按本地 Token 推算的已花费估算，不是上游账号剩余余额；OpenCode 免费模型无公开剩余额度接口。
- DeepSeek Harness（`dsh`）账号登录本身不提供公开余额接口，DeepSeek 卡片展示的是所配置的开放平台 API Key 余额。
