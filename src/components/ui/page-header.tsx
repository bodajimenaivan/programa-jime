export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="pb-6 pt-6 lg:pt-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="min-w-0 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.02em] lg:text-[34px]">{title}</h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {subtitle && <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-muted">{subtitle}</p>}
    </div>
  );
}
