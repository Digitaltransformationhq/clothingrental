"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/sell/fields";
import { savePayoutAccount } from "@/server/actions/profile";

/**
 * The payout account form.
 *
 * The account number field is deliberately not pre-filled when editing: the
 * full number is not stored, so there would be nothing truthful to put in it.
 * Saying so is better than showing masked digits that imply we hold them.
 */
export function PayoutAccountForm({
  initial,
  hasAccount,
}: {
  initial?: { beneficiaryName: string; ifscCode: string; upiHandle: string };
  hasAccount: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState({
    beneficiaryName: initial?.beneficiaryName ?? "",
    accountNumber: "",
    ifscCode: initial?.ifscCode ?? "",
    upiHandle: initial?.upiHandle ?? "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const set = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setErrors({});

    const result = await savePayoutAccount(values);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error.message);
      setErrors((result.error.fields ?? {}) as Record<string, string>);
      return;
    }

    setSaved(true);
    setValues((current) => ({ ...current, accountNumber: "" }));
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Field
        label="Name on the account"
        name="beneficiaryName"
        value={values.beneficiaryName}
        onChange={(value) => set("beneficiaryName", value)}
        error={errors.beneficiaryName}
      />

      <Field
        label="Account number"
        name="accountNumber"
        value={values.accountNumber}
        onChange={(value) => set("accountNumber", value.replace(/\D/g, ""))}
        error={errors.accountNumber}
        hint={
          hasAccount
            ? "Enter it again to change the account. We do not store the full number, so there is nothing to pre-fill."
            : "Held by our payment provider. We keep only the last four digits."
        }
      />

      <Field
        label="IFSC code"
        name="ifscCode"
        value={values.ifscCode}
        onChange={(value) => set("ifscCode", value.toUpperCase())}
        error={errors.ifscCode}
      />

      <Field
        label="UPI ID"
        name="upiHandle"
        optional
        value={values.upiHandle}
        onChange={(value) => set("upiHandle", value)}
        error={errors.upiHandle}
        hint="Faster for smaller payouts, where your bank supports it."
      />

      <div className="flex items-center gap-4 pt-2">
        <Button type="submit" loading={saving}>
          {hasAccount ? "Update account" : "Save account"}
        </Button>
        {saved ? (
          <p className="meta text-positive" role="status">
            Saved — verification usually takes a working day.
          </p>
        ) : null}
      </div>

      {formError ? (
        <p
          role="alert"
          className="border-critical bg-critical-soft text-small text-ink border-l-2 px-3 py-2"
        >
          {formError}
        </p>
      ) : null}
    </form>
  );
}
