"use client";

import { createAuthClient } from "better-auth/react";

/**
 * The browser-side auth client.
 *
 * Only ever used for actions that must originate in the browser — signing in,
 * signing up, signing out. Reading who is signed in is done on the server, in
 * layouts and pages, so that no page has to render a signed-out shell and then
 * correct itself once a request comes back.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
});

export const { signIn, signUp, signOut, useSession } = authClient;
