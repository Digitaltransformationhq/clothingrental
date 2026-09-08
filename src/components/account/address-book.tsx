"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/primitives";
import { deleteAddress, saveAddress } from "@/server/actions/addresses";
import type { SavedAddress } from "@/components/checkout/delivery-picker";

/**
 * The address book.
 *
 * Add, edit and remove. Editing reuses the same form as adding, because two
 * forms for one shape is two places for validation to drift.
 */
export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<string | "new" | null>(
    addresses.length === 0 ? "new" : null,
  );
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const current = addresses.find((address) => address.id === editing);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setErrors({});

    const form = new FormData(event.currentTarget);
    const result = await saveAddress({
      id: editing === "new" ? undefined : (editing ?? undefined),
      recipient: String(form.get("recipient") ?? ""),
      phone: String(form.get("phone") ?? ""),
      line1: String(form.get("line1") ?? ""),
      line2: String(form.get("line2") ?? "") || undefined,
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      isDefault: form.get("isDefault") === "on",
    });

    setPending(false);

    if (!result.ok) {
      setFormError(result.error.message);
      setErrors((result.error.fields ?? {}) as Record<string, string>);
      return;
    }

    setEditing(null);
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this address?")) return;
    setPending(true);
    await deleteAddress({ id });
    setPending(false);
    router.refresh();
  };

  return (
    <div>
      {addresses.length > 0 ? (
        <ul className="space-y-3">
          {addresses.map((address) => (
            <li key={address.id} className="border-rule bg-surface border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <address className="text-small text-ink-2 not-italic">
                  <span className="text-ink block">{address.recipient}</span>
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                  <br />
                  {address.city}, {address.state} {address.postalCode}
                  <br />
                  <span className="numeric">{address.phone}</span>
                </address>
                <div className="flex items-center gap-3">
                  {address.isDefault ? <Chip>Default</Chip> : null}
                  <button
                    type="button"
                    onClick={() => setEditing(address.id)}
                    className="link-underline text-small text-ink"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(address.id)}
                    disabled={pending}
                    className="link-underline text-small text-ink-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {editing === null ? (
        <Button variant="secondary" size="sm" className="mt-6" onClick={() => setEditing("new")}>
          Add an address
        </Button>
      ) : (
        <form
          onSubmit={submit}
          key={editing}
          className={addresses.length > 0 ? "border-rule mt-8 border-t pt-8" : ""}
        >
          <h3 className="title-2 mb-5">{editing === "new" ? "New address" : "Edit address"}</h3>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              label="Full name"
              name="recipient"
              defaultValue={current?.recipient}
              error={errors.recipient}
              autoComplete="name"
            />
            <FormField
              label="Phone"
              name="phone"
              defaultValue={current?.phone}
              error={errors.phone}
              autoComplete="tel"
            />
            <FormField
              label="Address"
              name="line1"
              defaultValue={current?.line1}
              error={errors.line1}
              autoComplete="address-line1"
              className="sm:col-span-2"
            />
            <FormField
              label="Flat, floor, landmark"
              name="line2"
              defaultValue={current?.line2 ?? ""}
              error={errors.line2}
              optional
              autoComplete="address-line2"
              className="sm:col-span-2"
            />
            <FormField
              label="City"
              name="city"
              defaultValue={current?.city}
              error={errors.city}
              autoComplete="address-level2"
            />
            <FormField
              label="State"
              name="state"
              defaultValue={current?.state}
              error={errors.state}
              autoComplete="address-level1"
            />
            <FormField
              label="PIN code"
              name="postalCode"
              defaultValue={current?.postalCode}
              error={errors.postalCode}
              autoComplete="postal-code"
            />
          </div>

          <label className="text-small text-ink-2 mt-5 flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={current?.isDefault ?? addresses.length === 0}
              className="h-3.5 w-3.5 accent-[var(--color-ink)]"
            />
            Use this by default
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="submit" loading={pending}>
              Save address
            </Button>
            {addresses.length > 0 ? (
              <Button type="button" variant="quiet" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            ) : null}
          </div>

          {formError ? (
            <p
              role="alert"
              className="border-critical bg-critical-soft text-small text-ink mt-4 border-l-2 px-3 py-2"
            >
              {formError}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}

function FormField({
  label,
  name,
  defaultValue,
  error,
  optional,
  autoComplete,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  optional?: boolean;
  autoComplete?: string;
  className?: string;
}) {
  // Uncontrolled: this form is submitted whole, and controlling seven inputs to
  // achieve the same result is state for its own sake.
  return (
    <div className={className}>
      <label htmlFor={`addr-${name}`} className="label text-ink-2 mb-2 block">
        {label}
        {optional ? (
          <span className="text-ink-3 ml-2 tracking-normal normal-case">optional</span>
        ) : null}
      </label>
      <input
        id={`addr-${name}`}
        name={name}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `addr-${name}-error` : undefined}
        className={`bg-surface text-small text-ink h-11 w-full border px-3 transition-colors focus:outline-none ${
          error ? "border-critical" : "border-rule focus:border-ink"
        }`}
      />
      {error ? (
        <p id={`addr-${name}-error`} className="meta text-critical mt-1.5">
          {error}
        </p>
      ) : null}
    </div>
  );
}
