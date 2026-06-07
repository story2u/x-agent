# Feature: Workspace Harness

## 当前状态

Workspace Harness 在 MVP 中收敛为本地 Markdown skill 组织：

```text
skills/<slug>/SKILL.md
skills/<slug>/references/*.md
skills/<slug>/evals/*.json
```

Skills 不再存储到 D1，也不再通过 Web Skill Studio 编辑。TUI 通过 `/skills`、`/skill` 读取和选择本地 skill。

## 默认内容

默认本地 skills：

- `twitter-launch-creative`：通用 X/Twitter 文本生成。
- `daily-fortune-tweet`：运营级今日运势技能，以星座 + 东方象征（节气/生肖/五行）为命理底料、Seth 意识框架为解释内核，运行时走 5 段推理 pipeline（understand → diverge → judge → draft → refine）+ 确定性当日 FortuneContext。

## 相关模块

- Local skills：`skills/*/SKILL.md`
- References：`skills/*/references/*.md`
- Evals：`skills/*/evals/*.json`
- Loader：`src/lib/skills/local-skills.ts`
- Parser：`src/lib/skills/parse-skill.ts`
- Validator：`src/lib/skills/validate-skill.ts`
- TUI：`scripts/x-agent-tui.ts`
- Agent：`src/lib/pi-agent.ts`
- Fortune pipeline / 星象引擎：`src/lib/fortune/pipeline.ts`、`src/lib/fortune/astro-day.ts`、共享 `src/lib/pi-model.ts`
- Eval runner：`scripts/eval-skills.ts`（形状校验）、`scripts/eval-fortune-run.ts`（真跑 + LLM-judge）
- Tests：`src/lib/__tests__/skills.test.ts`、`src/lib/__tests__/daily-fortune-evals.test.ts`、`src/lib/fortune/__tests__/astro-day.test.ts`、`src/lib/fortune/__tests__/pipeline.test.ts`

## SKILL.md 要求

每个本地 skill 必须包含：

- frontmatter `name`
- frontmatter `description`
- optional frontmatter `metadata.version`
- optional frontmatter `allowed-tools`
- Workflow / Process section
- Output Contract section
- Review Checklist / Safety Rules section

## Evals

Skill eval specs live in `skills/<slug>/evals/*.json` and define machine-checkable quality rules such as required fields, minimum hook/angle counts, forbidden phrases, minimum operator scores, long-tweet length, and thread roles.

质量门分三层：`eval:skills` 只校验 eval spec 的形状（无需凭据）；`eval:fortune:mock` 用确定性 fixture **离线**跑通 harness + 规则（无需凭据，进 CI）；`eval:fortune` 真跑 daily-fortune pipeline + 规则 + 独立 LLM-judge 对真实输出评分、打印运营达标率（需模型凭据）。

Commands:

```bash
npm run eval:skills                       # 形状校验（无需凭据）
npm run eval:skill -- daily-fortune-tweet
npm run eval:fortune:mock                 # 离线 harness 自检（无需凭据，进 CI）
npm run eval:fortune                      # 真跑 pipeline + LLM-judge（需凭据，本地手动门）
```

## Runtime 集成

生成时 `src/lib/pi-agent.ts` 会：

1. 调用 `resolveRuntimeSkill`。
2. 手动选择优先（未知 / 无效 skill 报错，不静默回退）；否则按 fortune 关键词自动选择；都不命中用默认 skill。
3. 加载完整本地 `SKILL.md`（无效 skill 不会被选择或注入 prompt）。
4. 加载 `references/*.md`，按文件名排序，以 `always` 策略注入 prompt。
5. 编译 skill-aware prompt。
6. 返回 `skillTrace` 给 TUI 展示，`loadedReferences` 包含 SKILL.md 和 references。

> 例外：选中 `daily-fortune-tweet` 时改走 `src/lib/fortune/pipeline.ts` 的 5 段推理（注入确定性当日星象事实，详见 `docs/数据流程.md`），不走单次 `finalize_twitter_creative`。

## 开发注意

- 新 skill 必须先创建 `skills/<slug>/SKILL.md`。
- 不要把 skill source of truth 写回 D1。
- 修改 validation 规则时要更新 `src/lib/__tests__/skills.test.ts`。
- References 仅支持本地 Markdown 文件和 prompt 注入；Knowledge Base、Tools / Extensions 暂不作为 MVP TUI 功能。
- Evals 分三层：`eval:skills` 校验 spec 形状、`eval:fortune:mock` 离线跑通 harness + 规则（两者均无凭据、进 CI）；`eval:fortune`（`scripts/eval-fortune-run.ts`）真跑 pipeline + LLM-judge 评真实输出、打印运营达标率（需凭据）。
