# Public Post Boundary

## Role

Separate internal safety/review logic from reader-facing content.

The final X/Twitter post must feel like a public social post, not a model safety report.

## Internal-only concepts

These concepts may guide reasoning, but must NOT appear directly in `final.longTweet.body` or `final.thread`:

- safety check / review checklist / operator critique
- entertainment disclaimer / deterministic-prediction warning
- "not financial advice" / "not a prediction" / "for entertainment only" / "as reflection"
- Seth framework / probability line / agency framing / risk reframe
- pipeline / stage / source level

## Forbidden reader-facing phrases

Do not include these in final public content:

- 把这条当作
- 仅供娱乐
- 娱乐与反思
- 不是预测
- 这不是预言
- 不构成投资建议
- 不保证
- 安全提醒
- 风险提示
- 审查
- pipeline
- Seth
- 情绪不是命令
- 概率线不是固定

## Non-technical audience jargon ban

Default audience is overseas young Chinese users, not builders or engineers. Unless the user explicitly asks for technical/programmer/engineer/developer readers, final public content must not include:

- AI 工具
- SaaS
- 云服务
- API
- productivity app
- builder
- debug
- terminal
- cron
- logs
- hotfix
- pending queue
- drain queue
- server
- on-call

## Correct behavior

If a draft contains an unsafe claim, **rewrite the claim into a safe fortune-style expression**.
Do NOT explain the safety policy to the reader.

Bad → Good:

- Bad: 把这条当作娱乐与反思的提示就好，不是预测你会赚多少。
  Good: 今天先别问会不会暴富。先看看钱包是不是在悄悄漏风。
- Bad: 这不是投资建议。
  Good: 今天不适合冲动付款。先让购物车冷静 24 小时。
- Bad: 概率线不是固定的。
  Good: 你今天改掉一个小动作，月底的你会轻一点。
- Bad: 情绪不是命令，它只是信号。
  Good: 今天心里有点闷别急着下单，先把那口气喘匀。

The safety posture stays the same — it just lives in the reasoning and in `reviewNotes`, never in the public post.
