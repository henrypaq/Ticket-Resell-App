/**
 * Label-above-field wrapper — the modern-form pattern (visible label, clean
 * rounded box below it) rather than relying on a placeholder alone. Only
 * used where a field doesn't already sit directly under a per-screen
 * question headline that says the same thing.
 */
export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
