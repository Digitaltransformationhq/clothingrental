import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { errors } from "@/server/errors";
import { getAuth } from "./config";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Session and authorisation helpers.
 *
 * Every protected page and every server action resolves the caller through
 * this module. Two rules it exists to enforce:
 *
 *  1. The caller's identity comes from the session cookie, never from an id in
 *     a form field, a query string or a request body. A client-supplied user id
 *     is an IDOR vulnerability waiting for someone to notice it.
 *  2. Authorisation is decided against the resource, not the route. Hiding a
 *     link is not access control; `assertOwner` is.
 */

export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly image: string | null;
  readonly role: UserRole;
  readonly emailVerified: boolean;
}

/**
 * The signed-in member, or null.
 *
 * `cache` de-duplicates per request: a layout, a page and three components can
 * each ask who the caller is and the session is resolved once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user as typeof session.user & { role?: string; status?: string };

  // A suspended member holds a valid cookie but must not act. Treating them as
  // signed out here means every downstream check gets it right for free.
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image ?? null,
    role: (user.role as UserRole) ?? "MEMBER",
    emailVerified: Boolean(user.emailVerified),
  };
});

/**
 * The signed-in member, or a redirect to sign-in.
 *
 * For pages. `next` carries the member back where they were going once they
 * have signed in.
 */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in");
  }
  return user;
}

/**
 * The signed-in member, or a thrown error.
 *
 * For server actions and route handlers, where a redirect would be swallowed
 * and the caller needs a result it can render.
 */
export async function requireUserOrThrow(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthenticated();
  return user;
}

export function isStaff(user: CurrentUser | null): boolean {
  return user?.role === "ADMIN" || user?.role === "MODERATOR";
}

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "ADMIN";
}

/**
 * Requires moderator or administrator. Guards the whole /admin surface.
 *
 * Renders a 404 rather than a 403, deliberately: a member who is not staff
 * learns nothing about what exists at this address. `notFound()` is used rather
 * than a thrown error so the framework renders the real not-found page — an
 * unhandled error would produce a 500, which is both wrong and a signal in
 * itself.
 */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (!isStaff(user)) notFound();
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (!isAdmin(user)) notFound();
  return user;
}

/**
 * The same check for server actions, where `notFound()` cannot be rendered.
 * Throws instead, and the action's `guard` turns it into a typed result.
 */
export async function requireStaffOrThrow(): Promise<CurrentUser> {
  const user = await requireUserOrThrow();
  if (!isStaff(user)) throw errors.notFound("page");
  return user;
}

export async function requireAdminOrThrow(): Promise<CurrentUser> {
  const user = await requireUserOrThrow();
  if (!isAdmin(user)) throw errors.notFound("page");
  return user;
}

/**
 * The ownership check every mutation on a member-owned resource must pass.
 *
 * Staff are permitted, because moderation and dispute resolution require it,
 * and every such action is written to the audit log by the calling service.
 */
export function assertOwner(
  user: CurrentUser,
  resource: { ownerId?: string; userId?: string; renterId?: string } | null,
  what = "item",
): void {
  if (!resource) throw errors.notFound(what);

  const ownerId = resource.ownerId ?? resource.userId ?? resource.renterId;
  if (ownerId === user.id) return;
  if (isStaff(user)) return;

  throw errors.forbidden(`That ${what} belongs to someone else.`);
}

/** True when the member may act on the resource, without throwing. */
export function canAct(
  user: CurrentUser | null,
  resource: { ownerId?: string; userId?: string; renterId?: string } | null,
): boolean {
  if (!user || !resource) return false;
  const ownerId = resource.ownerId ?? resource.userId ?? resource.renterId;
  return ownerId === user.id || isStaff(user);
}
