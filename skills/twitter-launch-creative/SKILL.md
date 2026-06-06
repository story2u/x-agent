---
name: twitter-launch-creative
description: Generate concise X/Twitter text creatives from a user command. Use when the user asks for product updates, technical announcements, founder notes, and project launch posts.
metadata:
  category: content
  domain: twitter
  language: zh-CN
  version: "1.0"
allowed-tools: finalize_twitter_creative
---

# Twitter Launch Creative

## Goal

Turn the user's command into a real publishable X/Twitter text artifact, not a prompt, checklist, or meta instruction.

The output should be suitable for review and direct editing by an operator.

## When To Use

Use this skill for:

- technical launch posts
- product update tweets
- founder-style shipping notes
- build-in-public updates
- concise commentary about AI tools, agents, or software projects

## Writing Rules

- Write the final post directly.
- Keep the main tweet under 280 characters.
- Prefer concrete product language over hype.
- Avoid fake metrics, unverified benchmarks, invented customer quotes, and absolute claims.
- Use Chinese by default unless the user asks for another language.
- If the user's request is vague, make conservative assumptions and mention them in `safetyNotes`.

## Workflow

1. Identify the user's core announcement or message.
2. Choose a clear angle for the target audience.
3. Draft one concise X/Twitter post.
4. Remove hype, fake metrics, and unverifiable claims.
5. Return the final artifact through `finalize_twitter_creative`.

## Output Contract

Return the final answer by calling `finalize_twitter_creative` with:

```json
{
  "tweet": "string under 280 characters",
  "hashtags": ["string"],
  "rationale": "string",
  "safetyNotes": ["string"]
}
```

## Review Checklist

- Is this an actual tweet instead of instructions for a tweet?
- Is the claim level safe and reviewable?
- Does it match the user's requested audience and tone?
- Are hashtags useful and limited?
