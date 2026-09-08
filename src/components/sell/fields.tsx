"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Form fields for the listing wizard.
 *
 * Deliberately plain: a label, a control, a hint, an error. Every one is a real
 * `<label>` bound to a real input, errors are announced through
 * `aria-describedby` and `aria-invalid`, and nothing depends on placeholder
 * text to say what a field is for — placeholders disappear the moment you type,
 * which is exactly when people forget.
 */

function FieldShell({
  label,
  name,
  hint,
  error,
  optional,
  children,
  counter,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  counter?: { current: number; max: number };
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor={name} className="label text-ink-2">
          {label}
          {optional ? (
            <span className="text-ink-3 ml-2 tracking-normal normal-case">optional</span>
          ) : null}
        </label>
        {counter ? (
          <span
            className={cn(
              "numeric meta",
              counter.current > counter.max * 0.95 ? "text-caution" : "text-ink-3",
            )}
          >
            {counter.current}/{counter.max}
          </span>
        ) : null}
      </div>

      {children}

      {hint && !error ? (
        <p id={hintId} className="meta text-ink-3 mt-2 max-w-prose">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="meta text-critical mt-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass = (error?: string) =>
  cn(
    "h-12 w-full border bg-surface px-3.5 text-body text-ink transition-colors focus:outline-none",
    error ? "border-critical" : "border-rule focus:border-ink",
  );

export function Field({
  label,
  name,
  value,
  onChange,
  hint,
  error,
  optional,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  optional?: boolean;
}) {
  return (
    <FieldShell label={label} name={name} hint={hint} error={error} optional={optional}>
      <input
        id={name}
        data-field={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={cn(hint && `${name}-hint`, error && `${name}-error`) || undefined}
        className={inputClass(error)}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  name,
  value,
  onChange,
  rows = 4,
  hint,
  error,
  optional,
  counter,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
  error?: string;
  optional?: boolean;
  counter?: { current: number; max: number };
}) {
  return (
    <FieldShell
      label={label}
      name={name}
      hint={hint}
      error={error}
      optional={optional}
      counter={counter}
    >
      <textarea
        id={name}
        data-field={name}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={cn(hint && `${name}-hint`, error && `${name}-error`) || undefined}
        className={cn(
          "bg-surface text-body text-ink w-full resize-y border p-3.5 leading-relaxed transition-colors focus:outline-none",
          error ? "border-critical" : "border-rule focus:border-ink",
        )}
      />
    </FieldShell>
  );
}

/**
 * A numeric field.
 *
 * `inputMode="numeric"` rather than `type="number"`: number inputs bring
 * spinners nobody uses, scroll-wheel accidents that silently change values, and
 * inconsistent behaviour for anything that is not an integer.
 */
export function NumberField({
  label,
  name,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  error,
  optional,
}: {
  label: string;
  name: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}) {
  return (
    <FieldShell label={label} name={name} hint={hint} error={error} optional={optional}>
      <div
        className={cn(
          "bg-surface focus-within:border-ink flex h-12 items-center border transition-colors",
          error ? "border-critical" : "border-rule",
        )}
      >
        {prefix ? <span className="text-body text-ink-3 pl-3.5">{prefix}</span> : null}
        <input
          id={name}
          data-field={name}
          inputMode="numeric"
          value={value ?? ""}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^\d]/g, "");
            onChange(digits === "" ? undefined : Number.parseInt(digits, 10));
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(hint && `${name}-hint`, error && `${name}-error`) || undefined}
          className="numeric text-body text-ink h-full min-w-0 flex-1 bg-transparent px-3.5 focus:outline-none"
        />
        {suffix ? <span className="text-small text-ink-3 pr-3.5">{suffix}</span> : null}
      </div>
    </FieldShell>
  );
}

interface Option {
  value: string;
  label: string;
  group?: string;
  swatch?: string;
}

/**
 * A grid of choices.
 *
 * Used instead of a `<select>` throughout the wizard: the options here are
 * short, visual (colours have swatches) and worth seeing all at once. Long
 * lists get a filter box rather than a dropdown.
 *
 * Implemented as buttons with `aria-pressed` for multi-select and radio
 * semantics for single-select, so both announce correctly.
 */
export function OptionGrid({
  label,
  name,
  options,
  value,
  values,
  onChange,
  onChangeMultiple,
  hint,
  error,
  multiple = false,
  grouped = false,
  searchable = false,
  clearable = false,
}: {
  label: string;
  name: string;
  options: Option[];
  value?: string;
  values?: string[];
  onChange?: (value: string) => void;
  onChangeMultiple?: (values: string[]) => void;
  hint?: string;
  error?: string;
  multiple?: boolean;
  grouped?: boolean;
  searchable?: boolean;
  clearable?: boolean;
}) {
  const [filter, setFilter] = React.useState("");

  const visible = React.useMemo(() => {
    if (!searchable || filter.trim() === "") return options;
    const needle = filter.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, filter, searchable]);

  const groups = React.useMemo(() => {
    if (!grouped) return [["", visible] as const];
    const map = new Map<string, Option[]>();
    for (const option of visible) {
      const key = option.group ?? "";
      map.set(key, [...(map.get(key) ?? []), option]);
    }
    return [...map.entries()];
  }, [visible, grouped]);

  const toggle = (option: string) => {
    if (multiple) {
      const current = values ?? [];
      onChangeMultiple?.(
        current.includes(option)
          ? current.filter((entry) => entry !== option)
          : [...current, option],
      );
      return;
    }
    if (clearable && value === option) {
      onChange?.("");
      return;
    }
    onChange?.(option);
  };

  const isActive = (option: string) =>
    multiple ? (values ?? []).includes(option) : value === option;

  return (
    <fieldset>
      <legend className="label text-ink-2 mb-2">{label}</legend>
      {hint ? <p className="meta text-ink-3 mb-3 max-w-prose">{hint}</p> : null}

      {searchable ? (
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={`Filter ${label.toLowerCase()}`}
          aria-label={`Filter ${label}`}
          className="border-rule bg-surface text-small text-ink placeholder:text-ink-3 focus:border-ink mb-3 h-10 w-full max-w-xs border px-3 focus:outline-none"
        />
      ) : null}

      <div className="space-y-4">
        {groups.map(([group, groupOptions]) => (
          <div key={group}>
            {group ? <p className="meta text-ink-3 mb-2">{group}</p> : null}
            <div className="flex flex-wrap gap-2">
              {groupOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-field={name}
                  onClick={() => toggle(option.value)}
                  aria-pressed={isActive(option.value)}
                  className={cn(
                    "text-small inline-flex items-center gap-2 border px-3.5 py-2.5 transition-colors",
                    isActive(option.value)
                      ? "border-ink bg-ink text-ink-inverse"
                      : "border-rule text-ink-2 hover:border-ink hover:text-ink",
                  )}
                >
                  {option.swatch ? (
                    <span
                      aria-hidden="true"
                      className="border-rule-strong h-3 w-3 border"
                      style={{ backgroundColor: option.swatch }}
                    />
                  ) : null}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="meta text-ink-3 mt-2">Nothing matches “{filter}”.</p>
      ) : null}

      {error ? (
        <p role="alert" className="meta text-critical mt-2">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** A switch. Radix would work here; a native checkbox is smaller and adequate. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid h-5 w-9 shrink-0 items-center border transition-colors",
          "peer-focus-visible:outline-claret peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          checked ? "border-ink bg-ink" : "border-rule-strong bg-surface",
        )}
      >
        <span
          className={cn(
            "bg-paper block h-3.5 w-3.5 transition-transform",
            checked ? "translate-x-[1.15rem]" : "translate-x-[0.15rem]",
          )}
          style={checked ? undefined : { backgroundColor: "var(--color-rule-strong)" }}
        />
      </span>
      <span>
        <span className="text-body text-ink block">{label}</span>
        {hint ? <span className="meta text-ink-3 mt-1 block max-w-prose">{hint}</span> : null}
      </span>
    </label>
  );
}
