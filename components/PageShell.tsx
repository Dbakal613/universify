import type { ReactNode } from "react";

export default function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen pb-24 md:ml-64 md:pb-8">
      <div className="mx-auto max-w-7xl p-5 md:p-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Universify
          </p>
          <h1 className="mt-2 text-4xl font-bold">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
          )}
        </header>

        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}
