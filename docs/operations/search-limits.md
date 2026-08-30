# Search input limits

Public search endpoints must validate and bound user-controlled geographic, category, and result-limit inputs before invoking external services. Invalid bounds fail closed instead of being forwarded upstream.
