# FreshFridge Backend – Architecture Rules

## Stack
- Node.js + Express
- TypeScript
- MSSQL via `mssql`
- JWT auth
- Validation via Zod

## Folder structure (must follow)
src/
  app.ts
  server.ts
  db/
    mssql.ts
  middleware/
    authMiddleware.ts
    errorHandler.ts
    validateBody.ts
    validateQuery.ts
  modules/
    <module>/
      <module>.routes.ts
      <module>.service.ts
      <module>.repo.ts
      <module>.validation.ts

## Routing rules
- Each module exposes an Express Router.
- All routes are prefixed in the router itself, e.g. `/api/products`.

## Auth rules
- Any protected endpoint MUST use `authMiddleware`.
- JWT is passed via `Authorization: Bearer <token>`.

## Validation rules
- Request body MUST be validated by `validateBody(zodSchema)`.
- Query params MUST be validated by `validateQuery(zodSchema)`.
- If validation fails → return 400 with readable error message.

## DB rules
- Repository layer only.
- Use parameterized queries only (no string concatenation with user input).

## API docs
- Swagger UI is available at `/docs`.
- OpenAPI spec is stored in `src/docs/openapi.yaml`.
- When adding new endpoints, update OpenAPI paths accordingly.

## Module template
Each new module must include:
- <module>.routes.ts — Express Router with URL prefix `/api/<module>`
- <module>.validation.ts — Zod schemas for body/query
- <module>.service.ts — business logic
- <module>.repo.ts — MSSQL queries (parameterized)