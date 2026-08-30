# Authentication security contract

Client roles must never receive access to verification-code storage. `email_verification_codes` is deny-by-default for `anon` and `authenticated`; server-side privileged code is responsible for controlled access.
