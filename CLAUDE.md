# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server (auto-reload on changes)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server (requires build first)
npm start
```

## Architecture

### Stack
- **Runtime**: Node.js with Express 
- **Language**: TypeScript (strict mode, CommonJS)
- **Database**: MSSQL via `mssql` package
- **Auth**: JWT-based authentication with bcrypt password hashing
- **Validation**: Zod schemas for request validation
- **API Docs**: Swagger UI at `/docs` (spec: `src/docs/openapi.yaml`)

### Layered Architecture

This codebase follows a strict 3-layer architecture within modules:

1. **Routes Layer** (`*.routes.ts`) - Express Router with URL prefixing, middleware attachment, and request/response handling
2. **Service Layer** (`*.service.ts`) - Business logic, orchestration, and JWT signing
3. **Repository Layer** (`*.repo.ts`) - Database queries using parameterized statements only

**Data flow**: Request → Routes (validation) → Service (logic) → Repository (DB) → Service → Routes → Response

### Module Structure

All feature modules live in `src/modules/<module>/` with exactly 4 files:
- `<module>.routes.ts` - Express Router with `/api/<module>` prefix
- `<module>.service.ts` - Business logic
- `<module>.repo.ts` - MSSQL queries (parameterized only)
- `<module>.validation.ts` - Zod schemas for body/query validation

Existing modules: `auth`, `products`

### Middleware Chain

Core middleware in `src/middleware/`:
- `authMiddleware.ts` - JWT verification, attaches `req.user: {id, email}` to request
- `validateBody(schema)` - Zod validation for request body
- `validateQuery(schema)` - Zod validation for query parameters
- `errorHandler` - Global error handler (must be last middleware)

### Database Connection

`src/db/mssql.ts` exports:
- `poolPromise` - Connection pool promise (await before queries)
- `sql` - MSSQL types for parameterized queries

Always use parameterized queries via `.input()` - never concatenate user input into SQL strings.

### Error Handling

Use custom error classes from `src/utils/errors.ts`:
- `BadRequestError(message)` - 400
- `UnauthorizedError(message)` - 401
- `ForbiddenError(message)` - 403
- `NotFoundError(message)` - 404
- `ConflictError(message)` - 409

Throw these in services/middleware; `errorHandler` catches and formats them.

### Authentication Flow

1. Login/Register returns `{user, accessToken}`
2. Protected routes require `authMiddleware`
3. JWT passed via `Authorization: Bearer <token>` header
4. Middleware verifies token and populates `req.user`
5. Token contains `{id, email}` and expires per `JWT_ACCESS_EXPIRES_IN` (default: 15m)

### Environment Configuration

Copy `.env.example` to `.env` and configure:
- `JWT_ACCESS_SECRET` - **Must change from default**
- `DB_SERVER`, `DB_DATABASE` - MSSQL connection details
- `DB_TRUSTED_CONNECTION=true` for Windows Auth, or set `DB_USER`/`DB_PASSWORD` for SQL Auth

### Adding New Endpoints

1. Create/update module files in `src/modules/<module>/`
2. Define Zod schemas in `<module>.validation.ts`
3. Write repository methods with parameterized queries
4. Implement business logic in service layer
5. Wire up routes with validation middleware
6. Add protected routes: `router.get("/api/path", authMiddleware, validateBody(schema), handler)`
7. Update `src/docs/openapi.yaml` with new endpoint documentation
8. Register router in `src/app.ts` via `app.use(newRoutes)`

### Type Safety Notes

- `req.user` is typed via global Express namespace extension in `authMiddleware.ts`
- Use `req.user!.id` in handlers after `authMiddleware` (non-null assertion safe here)
- Zod validation mutates `req.body` with parsed/coerced data
- For validated query params, cast to `(req as any).validatedQuery` (current pattern in products routes)

## Educational Context

This is a university laboratory project.
- Prefer clarity over abstraction
- Avoid over-engineering
- Explicit SQL queries are preferred over ORMs
- Code should be easy to explain during defense