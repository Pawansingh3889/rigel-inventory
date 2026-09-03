# Why signup is broken

Diagnosed 2026-09-03 against Supabase project `rkqgxrwnvyccxumiwfip`.

## Summary

Signup is gated behind an emailed OTP. The OTP email is sent from Resend's shared
sandbox sender, which only delivers to the Resend account owner. Every other applicant
never receives a code, so they can never clear the gate. The send failure is swallowed,
so the UI reports success while nothing was delivered.

Schema drift is **not** the cause. `register-business` was checked column by column
against the live schema and is clean.

## The evidence

`supabase/functions/send-otp/index.ts:107`

```ts
from: "Verification <onboarding@resend.dev>",
```

`onboarding@resend.dev` is Resend's sandbox address. Without a verified domain, Resend
delivers mail from it **only to the address that owns the Resend account**. All other
recipients are rejected.

The `email_otps` table matches that behaviour exactly. Twelve codes issued, one ever
consumed:

| requested | consumed | recipient |
| --- | --- | --- |
| 2025-08-27 16:40 | never | rigelenterpriseinfo@gmail.com |
| 2025-08-27 16:42 | never | rigelenterpriseinfo@gmail.com |
| 2025-10-03 16:32 | never | kapkotigirish07@gmail.com |
| 2025-10-04 07:05 | never | kapkotigirish07@gmail.com |
| 2025-10-04 07:11 | never | kapkotigirish07@gmail.com |
| 2025-10-05 11:15 | never | kapkotigirish07@gmail.com |
| 2025-10-05 11:22 | never | kapkotigirish07@gmail.com |
| 2025-10-05 11:23 | never | kapkotigirish07@gmail.com |
| 2025-10-06 20:11 | never | rigelenterpriseinfo@gmail.com |
| 2025-10-06 20:14 | never | rigelenterpriseinfo@gmail.com |
| 2025-10-06 20:27 | **20:27:47** | rigelenterpriseinfo@gmail.com |
| 2026-03-11 21:30 | never | kapkotigirish07@gmail.com |

One address ever succeeded, and it is almost certainly the Resend account owner. The
other applicant asked seven times across five months and never got in.

Corroborating: no company has been created by self-signup since **2025-09-03**, and no
profile since **2025-09-25**, while `security_audit_log` shows successful logins
continuing through **2026-08-30**. Existing users work. New ones cannot get in.

## Why nobody noticed

`supabase/functions/send-otp/index.ts:125`

```ts
} catch (emailError) {
  console.error("Email sending error:", emailError);
  // execution continues; the function still returns success
}
```

The send failure is logged and discarded. The client is told the code was sent, so users
retry rather than report a fault.

## Second defect on the same path

`supabase/functions/forgot-password/index.ts:140`

```ts
from: "Business Portal <noreply@yourdomain.com>",
```

`yourdomain.com` is placeholder text that was never replaced. Password reset email is
broken for the same reason, and cannot work until a real verified domain is set.

## Unrelated confirmed bug: sign-in rate limiting

`src/lib/security.ts:113` filters `auth_rate_limits` on `email`, but the live column was
renamed to `hashed_email`. Reproduced against the live API:

```
GET /rest/v1/auth_rate_limits?select=*&email=eq.<addr>
  400 {"code":"42703","message":"column auth_rate_limits.email does not exist"}
GET /rest/v1/auth_rate_limits?select=*&hashed_email=eq.<addr>
  200 []
```

`checkRateLimit` fails closed on error, returning `allowed: false`. In practice sign-in
still proceeds because `useAuth.tsx:225` deliberately soft-limits, so the visible symptom
is a spurious "Too many attempts" toast on every sign-in. Rate limiting itself is
completely non-functional: no attempt is ever counted, so brute-force protection is off.
The three call sites in `security.ts` and one in `useAuth.tsx` all need the column name
corrected, and `src/integrations/supabase/types.ts` is stale and should be regenerated.

## Fix order

1. Verify a real domain in Resend and replace both `from:` addresses. Nothing else on the
   signup path can work until this is done. This is an account action, not a code change.
2. Stop swallowing the send failure in `send-otp`, so a delivery fault surfaces instead of
   presenting as success.
3. Correct `email` to `hashed_email` in the four `auth_rate_limits` call sites.
4. Regenerate `src/integrations/supabase/types.ts` from the live schema.
