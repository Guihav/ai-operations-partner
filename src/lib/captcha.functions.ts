import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare test secrets:
// 1x0000000000000000000000000000000AA -> always passes
// 2x0000000000000000000000000000000AA -> always fails
const TEST_SECRET = "1x0000000000000000000000000000000AA";

/**
 * Verifies a Cloudflare Turnstile token.
 * Public server fn (no auth middleware) — only checks the token.
 */
export const verifyTurnstile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(1).max(2048) }).parse(input),
  )
  .handler(async ({ data }) => {
    const secret = process.env.TURNSTILE_SECRET_KEY || TEST_SECRET;

    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", data.token);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!res.ok) {
      return { success: false, error: "network" as const };
    }
    const json = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return {
      success: !!json.success,
      error: json.success ? undefined : (json["error-codes"]?.[0] ?? "unknown"),
    };
  });
