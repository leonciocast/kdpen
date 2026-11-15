/**
 * Thin wrapper over the Bedrock Converse API: one tool call that returns JSON,
 * with retries and backoff for throttling, a timeout, and token usage.
 * Server-only: credentials come from the standard AWS chain and never reach the browser.
 */
import { BedrockRuntimeClient, ConverseCommand, type ConverseCommandInput, type ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";

export const DEFAULT_MODEL = "us.anthropic.claude-sonnet-5-5";
export const DEFAULT_REGION = "us-east-1";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}
export interface ToolRequest {
  system: string;
  prompt: string;
  tool: { name: string; description: string; schema: Record<string, unknown> };
  maxTokens: number;
}
export interface ToolResult {
  input: unknown;
  usage: Usage;
  ms: number;
}
/** What the generator needs from a model: "call this tool with JSON". */
export type Llm = (req: ToolRequest, signal?: AbortSignal) => Promise<ToolResult>;

/** Anything with Converse's `send` (the real client, or a mock in tests). */
export interface ConverseSender {
  send(cmd: ConverseCommand, opts?: { abortSignal?: AbortSignal }): Promise<ConverseCommandOutput>;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "throttled" | "timeout" | "bad-output" | "upstream",
  ) {
    super(message);
  }
}

const RETRYABLE = /Throttling|TooManyRequests|ServiceUnavailable|ModelNotReady|InternalServer|ServiceQuota|ModelTimeout|ECONNRESET|socket hang up/i;
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), rej(new AiError("Cancelled", "timeout"))), { once: true });
  });

/** Pull the tool input out of a reply; accept a JSON text reply too. */
export function extractToolInput(out: ConverseCommandOutput, toolName: string): unknown {
  const content = out.output?.message?.content ?? [];
  for (const b of content) if (b.toolUse && (!b.toolUse.name || b.toolUse.name === toolName)) return b.toolUse.input;
  const text = content.map((b) => b.text ?? "").join("").trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      /* fall through */
    }
  }
  throw new AiError("The model didn't return the expected JSON.", "bad-output");
}

export interface BedrockOptions {
  client?: ConverseSender;
  modelId?: string;
  region?: string;
  /** Per-call timeout (ms). */
  timeoutMs?: number;
  retries?: number;
  /** Base backoff (ms); doubles each retry, with jitter. */
  backoffMs?: number;
}

export function bedrockLlm(opts: BedrockOptions = {}): Llm {
  const modelId = opts.modelId ?? process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL;
  const client = opts.client ?? new BedrockRuntimeClient({ region: opts.region ?? process.env.AWS_REGION ?? DEFAULT_REGION, maxAttempts: 1 });
  const retries = opts.retries ?? 5;
  const backoff = opts.backoffMs ?? 1500;
  // Force the tool where the model allows it. Newer Claude models on Bedrock (adaptive thinking)
  // only take tool_choice "auto", so ask for the tool in the prompt there; a refusal of a forced
  // choice also switches to "auto" for the rest of the run.
  const env = process.env.BEDROCK_TOOL_CHOICE;
  let forced = env === "tool" || (env !== "auto" && !/claude-(sonnet|opus|haiku)-[5-9]/.test(modelId));
  return async (req, signal) => {
    const t0 = Date.now();
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const input: ConverseCommandInput = {
        modelId,
        system: [{ text: req.system }],
        messages: [{ role: "user", content: [{ text: forced ? req.prompt : `${req.prompt}\n\nAnswer only by calling the ${req.tool.name} tool.` }] }],
        inferenceConfig: { maxTokens: req.maxTokens },
        toolConfig: {
          tools: [{ toolSpec: { name: req.tool.name, description: req.tool.description, inputSchema: { json: req.tool.schema as never } } }],
          toolChoice: forced ? { tool: { name: req.tool.name } } : { auto: {} },
        },
      };
      const timeout = AbortSignal.timeout(opts.timeoutMs ?? 180000);
      const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const out = await client.send(new ConverseCommand(input), { abortSignal });
        const usage = { inputTokens: out.usage?.inputTokens ?? 0, outputTokens: out.usage?.outputTokens ?? 0 };
        if (out.stopReason === "max_tokens") throw new AiError("The reply was cut off (too long).", "bad-output");
        return { input: extractToolInput(out, req.tool.name), usage, ms: Date.now() - t0 };
      } catch (e) {
        lastErr = e;
        const err = e as Error & { name?: string; $metadata?: { httpStatusCode?: number } };
        const msg = `${err.name ?? ""} ${err.message ?? ""}`;
        if (signal?.aborted) throw new AiError("Cancelled", "timeout");
        if (forced && /tool_?choice/i.test(msg)) {
          forced = false;
          attempt--;
          continue;
        }
        if (/AccessDenied|UnrecognizedClient|InvalidSignature|CredentialsProviderError|Could not load credentials|security token/i.test(msg)) throw new AiError("AWS credentials are missing or not allowed to use this model.", "config");
        if (/ResourceNotFound|model identifier is invalid|on-demand throughput isn/i.test(msg)) throw new AiError(`The model ${modelId} isn't available in this AWS region or account.`, "config");
        const timedOut = err.name === "AbortError" || err.name === "TimeoutError" || timeout.aborted;
        const retryable = timedOut || e instanceof AiError || RETRYABLE.test(msg) || (err.$metadata?.httpStatusCode ?? 0) >= 500 || err.$metadata?.httpStatusCode === 429;
        if (!retryable || attempt === retries) break;
        await sleep(backoff * 2 ** attempt * (0.75 + Math.random() * 0.5), signal);
      }
    }
    const e = lastErr as Error & { name?: string };
    if (e instanceof AiError) throw e;
    if (/Throttling|TooManyRequests/i.test(`${e?.name} ${e?.message}`)) throw new AiError("AWS is busy (throttled). Please try again in a minute.", "throttled");
    if (e?.name === "AbortError" || e?.name === "TimeoutError") throw new AiError("The model took too long to answer.", "timeout");
    throw new AiError("The AI service couldn't answer right now.", "upstream");
  };
}

/** Price per million tokens (USD) for the cost estimate in the server log. */
export function pricePerMillion(): { input: number; output: number } {
  const id = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL;
  const geo = !id.startsWith("global.");
  return { input: Number(process.env.BEDROCK_PRICE_IN ?? (geo ? 2.2 : 2)), output: Number(process.env.BEDROCK_PRICE_OUT ?? (geo ? 11 : 10)) };
}
export const costOf = (u: Usage) => {
  const p = pricePerMillion();
  return (u.inputTokens * p.input + u.outputTokens * p.output) / 1e6;
};
