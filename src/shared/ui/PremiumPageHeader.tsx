import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
}

export function PremiumPageHeader({ eyebrow, title, description, right }: Props) {
  return (
    <header className="flex items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-(--color-cyan)">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-extrabold leading-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-(--color-muted)">{description}</p>}
      </div>
      {right}
    </header>
  );
}
