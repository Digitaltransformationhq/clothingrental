import { redirect } from "next/navigation";

/**
 * "Orders" is the language of a shop. Here the thing you have is a rental, and
 * that is what the page is called — but the address is a natural guess, so it
 * resolves rather than 404s.
 */
export default function OrdersPage() {
  redirect("/account/rentals");
}
