/** Empty/success states use a thin outline icon, not an emoji (STYLE.md § iconography). */
export function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  title: string;
  detail?: string;
}) {
  return (
    <div className="surface rounded-2xl px-6 py-12 text-center">
      <Icon className="mx-auto h-6 w-6 text-muted" />
      <p className="mt-4 text-[15px] font-medium">{title}</p>
      {detail && <p className="mx-auto mt-2 max-w-xs text-[13.5px] leading-relaxed text-muted">{detail}</p>}
    </div>
  );
}
