import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
  fetch(request) {
    if (new URL(request.url).pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8",
        },
      });
    }
    return handler.fetch(request);
  },
});
