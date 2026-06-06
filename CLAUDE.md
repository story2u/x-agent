@/Users/bruce/.codex/RTK.md

# x-agent AI 开发规范

本项目采用文档驱动的 harness 开发方式。任何 AI 或人工在实现功能、修复缺陷、调整架构前，都必须先阅读 docs 中的核心导航文档，并在完成后回写文档。

## 必读顺序

开始编码前按顺序阅读：

1. `docs/README.md`：文档地图和导航入口。
2. `docs/开发规范.md`：编码边界、质量门、文档回写要求。
3. `docs/架构文档.md`：模块边界和运行时架构。
4. `docs/开发流程.md`：需求到提交的固定步骤。
5. `docs/功能导航.md`：按功能定位具体模块。
6. `docs/业务流程.md`：运营后台和 agent 工作流。
7. `docs/数据流程.md`：请求、模型调用、本地 skill、OAuth credentials 数据流。

如果要开发具体功能，还必须阅读 `docs/features/` 下对应功能文档。没有对应文档时，先创建或补齐功能文档，再开始实现。

## Harness 工作流

每次开发必须遵循：

1. 定位：从 `docs/功能导航.md` 找到功能域和相关模块。
2. 对齐：阅读对应 `docs/features/*.md`，确认入口、状态、API、数据表和测试点。
3. 实现：只改相关模块，避免无关重构。
4. 验证：按改动风险运行 `npm run typecheck`、`npm run lint`、`npm test` 中必要项。
5. 回写：修改完成后，把新增能力、行为变化、风险或后续任务写回 docs 对应文档。

## 文档回写规则

必须回写：

- 新增或修改用户可见功能。
- 模型 provider、模型凭据逻辑、OAuth、`.env` 变量变化。
- agent prompt、tool schema、模型 provider、模型凭据逻辑变化。
- UI 布局、导航、状态面板、错误提示等工作流变化。
- CLI/TUI 入口、slash commands、脚本参数等操作面变化。
- 本地 `skills/*/SKILL.md` 组织、选择规则、slash command 行为变化。

优先回写位置：

- 架构变更：`docs/架构文档.md`
- 开发规则变更：`docs/开发规范.md` 或 `docs/开发流程.md`
- 业务流程变更：`docs/业务流程.md`
- 数据/API 变更：`docs/数据流程.md`
- 具体功能变更：`docs/features/*.md`

## 当前产品边界

MVP 阶段专注 X/Twitter 文本生成。当前主操作入口是 `npm run tui` 的本地 CLI/TUI client：一个输入框接收对话请求，其他能力通过 `/` slash commands 调用。Web 登录、Web Review Gate、Web 后台审批流不再是当前产品边界。Skills 的 source of truth 是本地 `skills/*/SKILL.md`，不得重新把 skill 存储迁回 D1，除非先更新 docs 并明确进入新里程碑。界面不提供图片生成、图片方向、alt text 或 media upload。
