"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/sell/fields";
import { updateProfile } from "@/server/actions/profile";

/**
 * The public profile form.
 *
 * Shows the resulting URL under the handle field as it is typed, because
 * "handle" means nothing to most people and `almirah.example/wardrobe/meher`
 * means everything.
 */
export function ProfileForm({
  initial,
}: {
  initial: { name: string; handle: string; bio: string; city: string; state: string };
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const set = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setErrors({});

    const result = await updateProfile(values);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error.message);
      setErrors((result.error.fields ?? {}) as Record<string, string>);
      return;
    }

    setSaved(true);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Field
        label="Name"
        name="name"
        value={values.name}
        onChange={(value) => set("name", value)}
        error={errors.name}
      />

      <div>
        <Field
          label="Handle"
          name="handle"
          value={values.handle}
          onChange={(value) => set("handle", value.toLowerCase())}
          error={errors.handle}
        />
        <p className="meta text-ink-3 mt-2">
          Your wardrobe lives at{" "}
          <span className="text-ink-2">/wardrobe/{values.handle || "your-handle"}</span>
        </p>
      </div>

      <TextArea
        label="About you"
        name="bio"
        rows={4}
        optional
        value={values.bio}
        onChange={(value) => set("bio", value)}
        error={errors.bio}
        hint="A line or two about what is in your cupboard and why. This does more for trust than anything else on the page."
        counter={{ current: values.bio.length, max: 400 }}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="City"
          name="city"
          optional
          value={values.city}
          onChange={(value) => set("city", value)}
          error={errors.city}
        />
        <Field
          label="State"
          name="state"
          optional
          value={values.state}
          onChange={(value) => set("state", value)}
          error={errors.state}
        />
      </div>

      <div className="flex items-center gap-4 pt-2">
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
        {saved ? (
          <p className="meta text-positive" role="status">
            Saved
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
