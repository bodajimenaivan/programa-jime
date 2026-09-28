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
    <div className="flex items-end justify-between gap-4 pb-5 pt-5 lg:pt-8">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-bold leading-[1.1] tracking-[-0.02em] lg:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-xl text-[14.5px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
