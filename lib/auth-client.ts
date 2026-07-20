import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    // No baseURL needed - uses same domain by default
})