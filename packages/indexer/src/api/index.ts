import { Hono } from "hono";
import { graphql } from "ponder";
import { db } from "ponder:api";
import schema from "ponder:schema";

/// Ponder requires an API entry point. It serves a generated GraphQL endpoint
/// over the indexed tables, which is useful for exploring the data during
/// development.
///
/// The web app does NOT consume this — it reads the same Postgres tables
/// through its own /api/* routes. That keeps the "frontend talks to a local
/// database" story intact and keeps Member 3's contract stable, rather than
/// coupling the UI to Ponder's schema.
const app = new Hono();

app.use("/graphql", graphql({ db, schema }));

export default app;
