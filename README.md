# T3 Chat Clone

A Next.js chat application with Prisma, PostgreSQL, and shadcn/ui.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 📚 Documentation

<details>
<summary><b>1. Prisma & Database Connection</b></summary>

### What is Prisma?

Prisma is an ORM (Object-Relational Mapping) that provides a type-safe database query library. It generates a client based on your schema.

### Database Connection Flow

```
Your Code → Prisma Client → Adapter → Connection Pool → PostgreSQL
```

### Key Files

- `prisma/schema.prisma` - Database schema definition
- `prisma.config.ts` - Prisma configuration (database URL)
- `lib/db.ts` - Prisma client singleton with connection pool
- `lib/generated/prisma/` - Auto-generated Prisma client

### The Singleton Pattern

```typescript
// lib/db.ts
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Why?** Prevents multiple database connections during hot-reload in development.

</details>

<details>
<summary><b>2. Connection Pool</b></summary>

### What is a Connection Pool?

A connection pool maintains multiple open connections to the database, reusing them instead of creating new ones for each query.

### Why Use It?

- **Performance**: Creating connections is slow (~100-300ms)
- **Resource Management**: Limits concurrent connections
- **Prevents Memory Leaks**: In development, hot-reload can create many connections

### Connection Pool Settings (Neon / Serverless)

Our `lib/db.ts` configures the pool for Neon's serverless Postgres:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30_000, // wait through Neon cold starts
  idleTimeoutMillis: 30_000,
  max: 5,                          // avoid exhausting Neon's connection limit
});
```

**Why these values?** Neon's compute scales to zero when idle, so the first connection after a pause can take a few seconds to "wake up." The short default `pg` timeout caused intermittent `PrismaClientKnownRequestError` (P1001) errors mid-query; the longer timeout and bounded pool fix that.

</details>

<details>
<summary><b>3. Prisma Client & Adapter</b></summary>

### Prisma Client

The generated query library with type-safe methods:

```typescript
// Query methods
await prisma.user.findMany();
await prisma.user.findUnique({ where: { id: 1 } });
await prisma.user.create({ data: { name: "John" } });
await prisma.user.update({ where: { id: 1 }, data: { name: "Jane" } });
await prisma.user.delete({ where: { id: 1 } });
```

### Adapter Pattern

The adapter connects Prisma to different database connection methods:

| Environment         | Adapter            |
| ------------------- | ------------------ |
| Traditional Server  | `PrismaPg`         |
| Serverless (Vercel) | `PrismaNeon`       |
| Edge Functions      | `PrismaAccelerate` |

```typescript
// In your code
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

</details>

<details>
<summary><b>4. Next.js App Router</b></summary>

### File Structure

```
app/
├── layout.tsx    # Root layout - wraps all pages
├── page.tsx      # Homepage component
```

### How It Works

- Each folder in `app/` represents a route
- `page.tsx` makes that route accessible
- `layout.tsx` wraps pages in that folder and subfolders

### Root Layout

```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
```

</details>

<details>
<summary><b>5. shadcn/ui Components</b></summary>

### What is shadcn/ui?

A component library that provides copy-paste React components styled with Tailwind CSS.

### Usage

```typescript
import { Button } from "@/components/ui/button";

<Button variant="default">Click me</Button>
```

### Available Components

Located in `components/ui/` - includes Button, Card, Dialog, and more.

</details>

<details>
<summary><b>6. Authentication with Better Auth</b></summary>

### Session-Based by Default (Not JWT / Token-Based)

Better Auth uses **database-backed sessions** by default:

- On login it creates a row in the `session` table and sets an **HTTP-only cookie** containing an **opaque random token** (the `token` column) — *not* a JWT.
- On each request, `getSession` reads the cookie, queries the `session` table, and joins the `user` table.

This is why every authenticated request hits our database. (Better Auth *can* be configured for stateless JWT sessions or `Authorization: Bearer` / API-key auth, but the default is stateful DB sessions.)

### It Uses OUR Database

In `lib/auth.ts` we bridge Better Auth to our Prisma client:

```typescript
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // ...
});
```

`prismaAdapter` is what tells Better Auth to store sessions/users in **our** `user`, `session`, `account`, and `verification` tables on our Neon Postgres database.

### `getCurrentUser` & `session.user`

`modules/authentication/actions/index.ts`:

```typescript
export const getCurrentUser = async () => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    return session.user;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("getCurrentUser: failed to fetch session", error);
    } else {
      console.warn("getCurrentUser: failed to fetch session");
    }
    return null;
  }
};
```

Flow:

1. Read the session cookie.
2. Query our `session` table (`db.session.findFirst({ where: { token } })`).
3. Join to our `user` table via `session.userId`.
4. Return that row as `session.user`.

**`session.user` is the current, live row of the logged-in user in OUR `user` table** — re-queried on every call, so it always reflects the latest DB state. A separate `prisma.user.findUnique({ where: { id: session.user.id } })` would be redundant for the default fields; it is only needed if you require custom columns that `getSession` isn't configured to return (in which case prefer declaring `additionalFields` in `lib/auth.ts`).

### Why `getCurrentUser` Catches Errors

The `try/catch` degrades a failed session lookup (e.g. a transient DB connection drop) to `null` ("not authenticated") instead of crashing the page. This is exactly what happened with the intermittent Neon cold-start error: `getSession`'s `findFirst` failed, was caught, and returned `null` (see section 2 for the connection hardening that prevents it).

</details>

<details>
<summary><b>7. API Route Handlers — Best Practices</b></summary>

### Example: `app/api/ai/get-models/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // 1. Validate environment first
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not defined" },
      { status: 500 },
    );
  }

  try {
    // 2. Fetch external API
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-Type": "application/json",
      },
    });

    // 3. Handle non-200 responses from upstream
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch models" },
        { status: 502 }, // Bad Gateway — upstream failed
      );
    }

    // 4. Parse and transform
    const data = await res.json();
    const freeModels = data.data.filter(
      (m: any) => m.pricing.prompt === "0" && m.pricing.completion === "0",
    );

    // 5. Return success
    return NextResponse.json(freeModels);
  } catch (err) {
    // 6. Catch network errors — log the real error, return a clean message
    console.error("OpenRouter request failed:", err);
    return NextResponse.json(
      { error: "Could not reach OpenRouter" },
      { status: 502 },
    );
  }
}
```

### The 6 Principles for Any Future API Endpoint

#### 1. Validate inputs / environment first
Check env vars, params, and request body **before** doing anything else. Fail fast.

```typescript
if (!process.env.SOME_KEY)
  return Response.json({ error: "Missing config" }, { status: 500 });
if (!body.name)
  return Response.json({ error: "Name is required" }, { status: 400 });
```

#### 2. Use try/catch around external calls
Any `fetch`, database query, or third-party API can throw. Always wrap it.

#### 3. Return meaningful HTTP status codes

| Code | Meaning | When to use |
|---|---|---|
| **200** | OK | Everything worked |
| **400** | Bad Request | Client sent bad data |
| **401** | Unauthorized | Client isn't logged in |
| **403** | Forbidden | Client is logged in but not allowed |
| **404** | Not Found | Resource doesn't exist |
| **500** | Internal Server Error | Your server is broken (missing env var, crash, etc.) |
| **502** | Bad Gateway | An API you call failed |
| **504** | Gateway Timeout | An API you call timed out |

#### 4. Don't leak internals to the client
Log the real error on the server, return a clean message to the client.

```typescript
catch (err) {
  console.error("Real error for debugging:", err);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
```

#### 5. Separate client errors (4xx) from server errors (5xx)
- **4xx** = the client did something wrong (bad request, not authenticated).
- **5xx** = your server or something it depends on is broken.

The frontend uses this distinction to decide what to show the user.

#### 6. Keep each handler focused
One route = one job. Don't mix authentication, database writes, and external API calls in the same handler.

</details>

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://prisma.io/docs)
- [shadcn/ui](https://ui.shadcn.com)
