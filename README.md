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
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: adapter
})

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

### Default Pool Settings
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,              // Max 10 connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

</details>

<details>
<summary><b>3. Prisma Client & Adapter</b></summary>

### Prisma Client
The generated query library with type-safe methods:
```typescript
// Query methods
await prisma.user.findMany()
await prisma.user.findUnique({ where: { id: 1 } })
await prisma.user.create({ data: { name: "John" } })
await prisma.user.update({ where: { id: 1 }, data: { name: "Jane" } })
await prisma.user.delete({ where: { id: 1 } })
```

### Adapter Pattern
The adapter connects Prisma to different database connection methods:

| Environment | Adapter |
|-------------|---------|
| Traditional Server | `PrismaPg` |
| Serverless (Vercel) | `PrismaNeon` |
| Edge Functions | `PrismaAccelerate` |

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

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://prisma.io/docs)
- [shadcn/ui](https://ui.shadcn.com)