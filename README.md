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

<details>
<summary><b>8. TanStack Query — Server State Management</b></summary>

### What problem does it solve?

TanStack Query manages **server state** — data that lives on your server (database, external API) and is fetched into the UI. It eliminates the need for manual `useEffect` + `useState` fetching boilerplate.

### Where it's wired in our app

**`components/providers/query-provider.tsx`** — creates a `QueryClient` instance and wraps the app:

```typescript
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 min before refetch
            retry: 2,                  // retry twice on failure
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**`app/layout.tsx`** — wraps the entire app:

```typescript
<QueryProvider>
  <ThemeProvider>
    <TooltipProvider>{children}</TooltipProvider>
  </ThemeProvider>
</QueryProvider>
```

### How to use it in any client component

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";

export function ModelList() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["free-models"],         // unique cache key
    queryFn: async () => {
      const res = await fetch("/api/ai/get-models");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) return <p>Loading...</p>;
  if (isError) return <p>Error: {error.message}</p>;
  return data.map((model: any) => <p key={model.id}>{model.name}</p>);
}
```

### Key Concepts

| Concept | What it means |
|---|---|
| **queryKey** | A unique identifier for each piece of data (e.g. `["free-models"]`). Two components with the same key share one cache entry and one fetch. |
| **queryFn** | The function that fetches data. Must return a promise. Throwing an error triggers retry. |
| **staleTime** | How long data is considered "fresh" before TanStack Query re-fetches in the background. We set 5 min. |
| **gcTime** | How long unused cache data stays in memory before cleanup. Default 5 min. |
| **retry** | How many times to retry failed fetches before showing the error. We set 2. |
| **isLoading** | `true` only on the **first load** (no cached data and fetch is in progress) |
| **isFetching** | `true` on **any** fetch, including background refetches (useful for showing a subtle refresh indicator) |

### Server State vs Client State

| | Server State (TanStack Query) | Client State (React `useState`) |
|---|---|---|
| **Examples** | AI models list, chat messages, user profile | Form input, dropdown open/close, selected item ID |
| **Where data lives** | Server / DB / external API | Browser memory |
| **Who manages it** | TanStack Query | React |
| **How to get it** | `useQuery` | `useState` or `useReducer` |
| **How to update it** | `useMutation` + `invalidateQueries` | `setState(...)` |
| **Does it persist on refresh?** | Yes (re-fetched from server) | No (unless saved to localStorage) |
| **Can other users see changes?** | Yes | No |

### Rule of thumb

> "If another user changes this data, should my UI update?"
>
> - **Yes** → Server State → TanStack Query (`useQuery`)
> - **No** → Client State → React (`useState`)

</details>

<details>
<summary><b>9. Chat UI Components — Patterns & Lessons</b></summary>

### Files
| Component | Purpose | Location |
|---|---|---|
| `ChatMessageView` | Orchestrator — manages suggestion state, renders tabs + form | `modules/chat/components/chat-view/chat-message-view.tsx` |
| `ChatWelcomeTabs` | Welcome screen with category tabs and suggestion messages | `modules/chat/components/chat-view/chat-welcome-tabs.tsx` |
| `ChatMessageForm` | Text input + model selector + send button | `modules/chat/components/chat-view/chat-message-form.tsx` |
| `ModelSelector` | Searchable model picker (popover) + details dialog | `modules/chat/components/chat-view/model-selector.tsx` |
| `useGetAiModels` | TanStack Query hook that fetches free models | `modules/chat/hooks/use-get-ai-models.ts` |

### Key Patterns Learned

1. **Base UI `render` prop (always for triggers)** — `PopoverTrigger`, `DropdownMenuTrigger` render their own `<button>`. Never nest a `Button` inside them. Use `render={<Button .../>}` to make the Button *become* the trigger.

2. **No `asChild` in Base UI** — `asChild` is a Radix UI concept. Base UI uses `render` instead. Passing `asChild` causes a DOM prop warning.

3. **Dialog closing Popover (outside click)** — A Dialog portaled to body triggers the Popover's "outside click" detection. Fix: guard `onOpenChange`:
   ```tsx
   onOpenChange={(nextOpen) => {
     if (detailsOpen && !nextOpen) return;
     setOpen(nextOpen);
   }}
   ```

4. **Null safety in API data** — OpenRouter API returns `null` for some fields (`max_completion_tokens`). Always guard: `if (!length) return "N/A"`.

5. **Suggestion injection pattern** — `ChatMessageView` holds `selectedMessage` state. `ChatWelcomeTabs` sets it via `onMessageSelect`. `ChatMessageForm` reads it via `initialMessage` prop, fills textarea via `useEffect`, then calls `onMessageChange("")` to reset.

6. **State per component** — Popover open/close, dialog open/close, search query, selected model — all local `useState` in `ModelSelector`. No context needed for 1-level prop drilling.

</details>

<details>
<summary><b>10. Server Actions + TanStack Query — The Cache-&-Security Pattern</b></summary>

### Why This Pattern Works

| Layer | What It Gives You | Why It Matters |
|---|---|---|
| **Server Actions** (`"use server"`) | Runs only on the server; no client bundle; type-safe RPC; direct DB access | You get **type-safe server code** without separate API route handlers. The server owns the trust boundary. |
| **TanStack Query** (`useQuery`/`useMutation`) | Caching, background refetch, deduplication, retries, optimistic updates, query invalidation | You get **automatic cache sync** without manual `useState` + `useEffect` spaghetti. |

Together, they give the best of both worlds:
- Server Actions become the **data source** (no REST endpoints needed).
- TanStack Query becomes the **cache manager** (not context/redux).

### Mental Model: Cache Keys Are Your API Contract

```ts
// Good query keys are hierarchical and scoped
queryKey: ["messages", chatId]   // Scoped to a chat
queryKey: ["chats", userId]       // Scoped to a user
queryKey: ["ai-models"]          // Global for everyone
```

When you create or delete data:
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
  // Forces TanStack to re-run the queryFn and update the UI
}
```

### Server Actions in TanStack Query — It's Safe

**Bad (calls on every render):**
```ts
queryFn: getAllChats(),   // ❌ Calls immediately — bad
```

**Good (function reference):**
```ts
queryFn: () => getAllChats(),   // ✅ Function passed; TanStack calls it on cache miss
```

A Server Action is just a function returning `Promise<T>` under the hood, so it works perfectly in `queryFn`.

### When to Use This Pattern

| Situation | ✅ Use Server Actions + TKQ | Reason |
|---|---|---|
| Full-stack TypeScript app (Next.js only) | ✅ Yes | Shared types, no API duplication |
| You need public endpoints (mobile, external APIs) | ❌ No | Server Actions are Next.js-internal |
| Simple static site with 1-2 reads | ❌ No | Overhead outweighs benefit |
| Chat/AI app with real-time-ish updates | ✅ Yes | Caching + invalidation is essential |

### Files in This Project

| File | Purpose |
|---|---|
| `modules/chat/actions/index.ts` | Server Actions (`createChatWithMessage`, `getAllChats`, `getChatById`, `deleteChat`) |
| `modules/chat/hooks/use-chats.ts` | TanStack Query wrappers (`useGetChats`, `useCreateChat`, `useDeleteChat`) |

### Pro Tips

1. **Group related actions** in one file (`modules/X/actions/index.ts`). It's your repository layer.
2. **One action = one concern** (`createChat`, `getAllChats`, `deleteChat`). Don't make monolithic actions.
3. **Return `{ success: boolean, data?, error? }`** — explicit and type-safe.
4. **Never call a Server Action directly from JSX** — always wrap in `useQuery` or `useMutation` so caching/retry works.
5. **For fire-and-forget operations** (no cache needed), call directly with `.then()`, but it's rare.

</details>

---

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://prisma.io/docs)
- [shadcn/ui](https://ui.shadcn.com)
