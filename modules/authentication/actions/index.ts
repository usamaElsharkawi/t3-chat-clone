"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const getCurrentUser = async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

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

export const requireAuth = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  return session;
};

export const requireUnAuth = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    return redirect("/");
  }

  return null;
};
