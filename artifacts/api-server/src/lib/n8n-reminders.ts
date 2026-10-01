export interface WebhookConfig {
  url: string;
  key: string;
}

export function getWebhookConfig(): WebhookConfig | null {
  const url = process.env.N8N_WEBHOOK_URL?.trim();
  const key = process.env.N8N_CHORE_KEY?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
  } catch {
    return null;
  }
  return { url, key };
}

// Never return upstream bodies or URLs in errors: they can contain credentials.
export class WebhookError extends Error {
  constructor(public readonly status: 502 | 504, message: string) {
    super(message);
  }
}

export async function sendToWebhook(
  config: WebhookConfig,
  payload: unknown,
  recipientCount: number,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const signal = AbortSignal.timeout(15_000);
  try {
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Chore-Key": config.key },
      body: JSON.stringify(payload),
      redirect: "error",
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new WebhookError(502, "The email workflow reported an error. Check its execution in n8n.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new WebhookError(502, "The email workflow returned an empty response.");
    let text = "";
    let size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        throw new WebhookError(502, "The email workflow returned an invalid response.");
      }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      throw new WebhookError(502, "The email workflow must respond with { ok: true, sent: number }.");
    }
    if (
      !result || typeof result !== "object" ||
      !("ok" in result) || result.ok !== true ||
      !("sent" in result) || typeof result.sent !== "number" ||
      !Number.isInteger(result.sent) || result.sent < 0 || result.sent > recipientCount
    ) {
      throw new WebhookError(502, "The email workflow did not confirm how many reminders were sent.");
    }
    return result.sent;
  } catch (error) {
    if (error instanceof WebhookError) throw error;
    if (signal.aborted || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) {
      throw new WebhookError(504, "The email workflow timed out. Delivery is unconfirmed; check n8n before trying again.");
    }
    throw new WebhookError(502, "Could not reach the email workflow. Delivery is unconfirmed; check n8n.");
  }
}