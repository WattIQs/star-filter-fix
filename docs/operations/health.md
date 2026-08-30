# Health endpoint

The application exposes `/health` as a lightweight liveness endpoint. Keep this endpoint independent from external providers and database queries so Render can use it without turning dependency failures into application restarts.
