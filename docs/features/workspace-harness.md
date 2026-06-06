# Feature: Workspace Harness

## 当前状态

Workspace Harness 在 MVP 中收敛为本地 Markdown skill 组织：

```text
skills/<slug>/SKILL.md
```

Skills 不再存储到 D1，也不再通过 Web Skill Studio 编辑。TUI 通过 `/skills`、`/skill` 读取和选择本地 skill。

## 默认内容

默认本地 skills：

- `twitter-launch-creative`：通用 X/Twitter 文本生成。
- `daily-fortune-tweet`：今日运势生成技能。

## 相关模块

- Local skills：`skills/*/SKILL.md`
- Loader：`src/lib/skills/local-skills.ts`
- Parser：`src/lib/skills/parse-skill.ts`
- Validator：`src/lib/skills/validate-skill.ts`
- TUI：`scripts/x-agent-tui.ts`
- Agent：`src/lib/pi-agent.ts`
- Tests：`src/lib/__tests__/skills.test.ts`

## SKILL.md 要求

每个本地 skill 必须包含：

- frontmatter `name`
- frontmatter `description`
- optional frontmatter `metadata.version`
- optional frontmatter `allowed-tools`
- Workflow / Process section
- Output Contract section
- Review Checklist / Safety Rules section

## Runtime 集成

生成时 `src/lib/pi-agent.ts` 会：

1. 调用 `resolveRuntimeSkill`。
2. 手动选择优先（未知 / 无效 skill 报错，不静默回退）；否则按 fortune 关键词自动选择；都不命中用默认 skill。
3. 加载完整本地 `SKILL.md`（无效 skill 不会被选择或注入 prompt）。
4. 编译 skill-aware prompt。
5. 返回 `skillTrace` 给 TUI 展示。

## 开发注意

- 新 skill 必须先创建 `skills/<slug>/SKILL.md`。
- 不要把 skill source of truth 写回 D1。
- 修改 validation 规则时要更新 `src/lib/__tests__/skills.test.ts`。
- References、Knowledge Base、Tools / Extensions 暂不作为 MVP TUI 功能。
