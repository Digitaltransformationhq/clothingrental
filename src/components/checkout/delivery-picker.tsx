"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { saveAddress, setRentalAddress } from "@/server/actions/addresses";

/**
 * Choosing where a rental goes.
 *
 * Appears on checkout rather than on the listing page, because asking somebody
 * for their postal address at the moment they have decided they want a dress is
 * how you lose them. By the time they are here they have already committed.
 *
 * If they have no address at all, the form is open by default — one fewer
 * click on the path that most first-time renters take.
 */

export interface SavedAddress {
  id: string;
  label: string | null;
  recipient: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
}

export function DeliveryPicker({
  rentalId,
  addresses,
  selectedId,
}: {
  rentalId: string;
  addresses: SavedAddress[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(addresses.length === 0);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const choose = async (addressId: string) => {
    setPending(true);
    const result = await setRentalAddress({ rentalId, addressId });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const result = await saveAddress({
      recipient: String(form.get("recipient") ?? ""),
      phone: String(form.get("phone") ?? ""),
      line1: String(form.get("line1") ?? ""),
      line2: String(form.get("line2") ?? "") || undefined,
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      isDefault: addresses.length === 0,
    });

    if (!result.ok) {
      setPending(false);
      setError(result.error.message);
      setFieldErrors((result.error.fields ?? {}) as Record<string, string>);
      return;
    }

    await choose(result.data.id);
    setAdding(false);
    setPending(false);
  };

  return (
    <div>
      {addresses.length > 0 ? (
        <ul className="space-y-2">
          {addresses.map((address) => (
            <li key={address.id}>
              <button
                type="button"
                onClick={() => choose(address.id)}
                disabled={pending}
                aria-pressed={address.id === selectedId}
                className={cn(
                  "flex w-full items-start gap-3 border p-4 text-left transition-colors",
                  address.id === selectedId
                    ? "border-ink bg-paper-2"
                    : "border-rule hover:border-ink",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
                    address.id === selectedId ? "border-ink" : "border-rule-strong",
                  )}
                >
                  {address.id === selectedId ? (
                    <span className="bg-ink h-1.5 w-1.5 rounded-full" />
                  ) : null}
                </span>
                <span className="text-small min-w-0 flex-1">
                  <span className="text-ink block">{address.recipient}</span>
                  <span className="text-ink-2 mt-0.5 block">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state}{" "}
                    {address.postalCode}
                  </span>
                  <span className="meta text-ink-3 mt-1 block">{address.phone}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="link-underline text-small text-ink mt-4"
        >
          Add another address
        </button>
      ) : (
        <form
          onSubmit={onSubmit}
          className={cn(addresses.length > 0 && "border-rule mt-6 border-t pt-6")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <AddressField
              label="Full name"
              name="recipient"
              autoComplete="name"
              error={fieldErrors.recipient}
            />
            <AddressField
              label="Phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              error={fieldErrors.phone}
            />
            <AddressField
              label="Address"
              name="line1"
              autoComplete="address-line1"
              error={fieldErrors.line1}
              className="sm:col-span-2"
            />
            <AddressField
              label="Flat, floor, landmark"
              name="line2"
              autoComplete="address-line2"
              optional
              error={fieldErrors.line2}
              className="sm:col-span-2"
            />
            <AddressField
              label="City"
              name="city"
              autoComplete="address-level2"
              error={fieldErrors.city}
            />
            <AddressField
              label="State"
              name="state"
              autoComplete="address-level1"
              error={fieldErrors.state}
            />
            <AddressField
              label="PIN code"
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              error={fieldErrors.postalCode}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="submit" loading={pending} size="sm">
              Save address
            </Button>
            {addresses.length > 0 ? (
              <Button type="button" variant="quiet" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      )}

      {error ? (
        <p
          role="alert"
          className="border-critical bg-critical-soft text-small text-ink mt-4 border-l-2 px-3 py-2"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AddressField({
  label,
  name,
  type = "text",
  autoComplete,
  inputMode,
  error,
  optional,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  error?: string;
  optional?: boolean;
  className?: string;
}) {
  const id = `address-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="label text-ink-2 mb-2 block">
        {label}
        {optional ? (
          <span className="text-ink-3 ml-1.5 tracking-normal normal-case">optional</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "bg-surface text-small text-ink h-11 w-full border px-3 transition-colors focus:outline-none",
          error ? "border-critical" : "border-rule focus:border-ink",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="meta text-critical mt-1.5">
          {error}
        </p>
      ) : null}
    </div>
  );
}
