import { redirect } from "next/navigation";

/**
 * `/account/profile` is where members expect to find their public details, but
 * everything there also belongs beside their account settings. Rather than
 * splitting one short form across two pages, this address redirects.
 */
export default function ProfilePage() {
  redirect("/account/settings");
}
