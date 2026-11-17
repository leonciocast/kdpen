# AI mystery cases (Amazon Bedrock)

"Generate a new mystery with AI" writes a fresh, original book: a storyline, a cast,
and every case (story, three suspects, evidence words, missing evidence, a culprit that the
hidden message points to, a lead to the next case), plus the final answer the Case Board spells.
The model runs in **your AWS account** through Amazon Bedrock. Keys stay on the server.

## How it works

When AWS is set up, the Murder Mystery flow opens on **Your next mystery** with one
**✨ New mystery** button (24 cases, Family, surprise setting by default). Setting, tone and count sit
behind a quiet **Customize** disclosure and are remembered; The Saltmere Lantern, pasting and the
template settings are under **Other ways to get cases** (and the Saltmere Lantern is the default when
AI isn't configured). The button is also on the review screen and after building; with a book on
screen it asks "Replace “…”?" first. Each book gets a random seed, a seeded starting idea for a
surprise setting (place, era, names), and the last 8 titles are kept in the browser and sent as
`avoid`, so books don't repeat.

1. The browser posts the options to `POST /api/mystery/generate`
   (`caseCount` up to 200, `setting` or `"surprise"`, `tone` family/teens/noir, difficulty, layers).
2. The server asks the model for an **outline** (title, intro, cast with traits, mastermind,
   final answer, one line per case), then writes the cases in **small batches of 3–4, all in parallel**
   (up to `AI_CONCURRENCY`, default 6), using the Bedrock **Converse** API with a JSON tool schema and
   low thinking effort (`BEDROCK_EFFORT`, default `low`; `off` to drop it — it is dropped
   automatically if the model refuses it). A real 6-case book took 23 s and cost $0.06
   (before: 3 cases in 155 s).
3. Every case is validated (zod), repaired locally where possible (letters only, length 3–11,
   no word inside another, culprit among the suspects…), checked for unsuitable words, and built
   with the puzzle engine. Cases that still fail are sent back with the exact problem, up to 2 times.
4. The browser polls `GET /api/mystery/generate/{id}` for progress (the book title and case titles as
   soon as the outline is in, ticked off as they're written, "N of M cases") and the result plus
   `stats` (`inputTokens`, `outputTokens`, `costUsd`, `calls`, `ms`, `model`), then shows the review
   screen (notes and cost behind a disclosure; ⋯ per case: **Regenerate this case** →
   `POST /api/mystery/regenerate-case`, Remove; ⋯ for the book: Customize, **Edit as text**).

Limits: 20 requests per IP per 10 minutes, 2 books at a time per IP, 200 cases per book,
3 minutes per model call, 20 minutes per book. Throttling is retried with exponential backoff.
Each call and each book is logged on the server with tokens and an estimated cost:

```
[ai-cases] k3j2… write_cases in=3120 out=2894 ~$0.0387 21.4s
[ai-cases] k3j2… book 24 cases: 24 kept, 5 calls, in=14210 out=13380 ~$0.178 74s model=us.anthropic.claude-sonnet-5-5
```

## Model

Default: `us.anthropic.claude-sonnet-5-5`: Claude Sonnet 5.5 (launched on Bedrock on
September 28, 2026), US cross-Region inference profile, called from `us-east-1`; it routes to
us-east-1, us-east-2 or us-west-2. Claude models on Bedrock must be called through an inference
profile (the bare model id gives "on-demand throughput isn't supported").
Alternatives: `global.anthropic.claude-sonnet-5-5` (about 10% cheaper, routed to any commercial region) or
`us.anthropic.claude-sonnet-4-6`. Set `BEDROCK_MODEL_ID` to switch.

## Setup (once)

1. **Turn on the model.** In the AWS console open *Amazon Bedrock → Model catalog* in
   **US East (N. Virginia) us-east-1**, open *Claude Sonnet 5.5* and complete Anthropic's one-time
   use-case form if asked. Bedrock subscribes the account on the first call; do that first call as an
   admin (for example with *Playground → Chat*), or give the IAM user the two
   `aws-marketplace` permissions below for that first call only.
2. **Create an IAM user** (for example `kdpen-bedrock`) with no console access and attach this
   inline policy (replace `123456789012` with your account id):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "InvokeClaudeSonnetViaUsProfile",
         "Effect": "Allow",
         "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
         "Resource": [
           "arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude-sonnet-5-5",
           "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-5-5",
           "arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-sonnet-5-5",
           "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-5-5"
         ]
       }
     ]
   }
   ```

   The Converse API is authorised by `bedrock:InvokeModel` (and the streaming variant by
   `bedrock:InvokeModelWithResponseStream`). Optional for the very first call only:
   `"aws-marketplace:ViewSubscriptions", "aws-marketplace:Subscribe"` on `"*"`; remove it afterwards.
3. **Create an access key** for that user (*Security credentials → Create access key →
   Application running outside AWS*).
4. **Put the keys on the server** in `.env.local` in the project folder (git-ignored), then rebuild
   and restart (`npm run build && npm run start`):

   ```
   AWS_REGION=us-east-1
   BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-5-5
   AWS_ACCESS_KEY_ID=AKIA…
   AWS_SECRET_ACCESS_KEY=…
   ```

   Or use `AWS_PROFILE=name` with `~/.aws/credentials`. See `.env.example` for every option.
5. Open *Word Search → Murder Mystery*: the first card, **Generate a new mystery with AI**, is now
   active. Without keys it shows a quiet *Needs AWS setup* and the other sources work as before.

Optional: set a monthly **AWS Budget** alert (for example $20) in *Billing → Budgets*.

## Cost

Sonnet 5.5 on Bedrock: $2.20 per million input tokens and $11 per million output tokens on the
`us.` profile ($2 / $10 on `global.`). Output includes the model's thinking tokens.

| Book | Calls | Tokens (approx.) | Cost (approx.) |
| --- | --- | --- | --- |
| 3 cases | 2 | 5k in, 4–8k out | $0.05–0.10 |
| 24 cases | 4–6 | 15k in, 15–30k out | $0.20–0.40 |
| 200 cases | 27–35 | 120k in, 120–250k out | $1.60–3.00 |

A single "Regenerate this case" is about $0.01–0.03. The server log shows the real numbers.

## Content rules

The prompt asks for original writing only: invented places and people, no real people or brands,
nothing from existing books, games or films, no gore, profanity or sexual content. Family
friendly is the default tone; *Adult noir* keeps crimes off the page. The server also filters
the output (blocked words and borrowed famous names) and rewrites any case that fails.

## Testing without AWS

`BEDROCK_MOCK=1 npm run start` answers from the built-in templates (one case comes back broken
on purpose, to exercise the repair round). `node scripts/ai-cases-e2e.mjs` checks the setup state on
:3000 (no keys) and the whole flow to a PDF on :3001 (mock). Unit tests: `tests/ai-cases.test.ts`.
