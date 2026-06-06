# x-agent Docs Harness

这是 x-agent 的文档导航入口。项目采用 harness 架构：AI 开发前先按文档定位功能、模块和流程，开发后把变更写回文档。

## 必读文档

- `开发规范.md`：编码规范、边界、质量门、文档回写要求。
- `架构文档.md`：系统架构、模块边界、本地 TUI 运行时。
- `开发流程.md`：从需求理解到提交的步骤。
- `功能导航.md`：按功能找到相关代码和文档。
- `业务流程.md`：TUI client、agent 生成、本地 skill 流程。
- `数据流程.md`：TUI 请求、模型调用、本地 skill、OAuth credentials 数据流。
- `features/`：每个功能域的专项说明。

## 功能文档

- `features/cli-tui.md`：CLI/TUI 主操作入口。
- `features/text-agent.md`：X/Twitter 文本生成 agent。
- `features/model-oauth.md`：ChatGPT Plus/Pro OAuth、OpenAI API key、DeepSeek API key 模型凭据（基于环境变量 / `.env`）。
- `features/workspace-harness.md`：本地 Markdown skills、references 与 evals 的组织、加载与选择。

## AI 开发入口

AI 接到需求时，先按 `AGENTS.md` 的必读顺序阅读文档。开发具体功能时，从 `功能导航.md` 找到功能域，再进入 `features/` 的对应文档。

## 文档维护原则

- 文档是开发 harness 的一部分，不是事后总结。
- 功能有变更，必须同步更新对应文档。
- 没有文档的功能，不应直接扩展代码；先补文档，再实现。
- 文档应能导航到具体模块、API、数据表、测试和部署事项。
