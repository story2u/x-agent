# x-agent Local Skills

TUI client skills live in this directory. Each skill is a folder with a `SKILL.md` file:

```text
skills/
  twitter-launch-creative/
    SKILL.md
  daily-fortune-tweet/
    SKILL.md
    references/
      *.md
    evals/
      *.json
```

The CLI/TUI loads these Markdown files directly at runtime. Skills are no longer authored or selected from D1 for the MVP client flow.

`references/*.md` are prompt-time support materials. `evals/*.json` are machine-checkable quality rules used by `npm run eval:skills`.
