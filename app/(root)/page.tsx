import { getCurrentUser } from "@/modules/authentication/actions";
import UserButton from "@/modules/authentication/components/user-button"

export default async function Home() {
  const user = await getCurrentUser()
  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      <h1 className="text-headline-xl text-surface-text-emphasis">
        T3 Chat Clone
      </h1>
      <p className="text-body-md text-muted-text mt-spacing-lg">
        Welcome. Start a conversation below.
      </p>
      <UserButton user={user} />
    </main>
  );
}