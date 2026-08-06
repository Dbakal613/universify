"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Hoy" },
  { href: "/trabajo-autonomo", label: "Repaso diario" },
  { href: "/horario", label: "Horario semanal" },
  { href: "/calendario", label: "Calendario mensual" },
  { href: "/ramos", label: "Mis ramos" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:bottom-auto md:right-auto md:top-0 md:h-screen md:w-64 md:border-r md:border-t-0">
        <div className="hidden px-6 py-7 md:block">
          <p className="text-2xl font-bold">Universify</p>
          <p className="mt-1 text-sm text-slate-500">University, simplified.</p>
        </div>

        <nav className="flex overflow-x-auto p-2 md:block md:space-y-2 md:px-4">
          {items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={active ? { color: "#ffffff" } : undefined}
                className={`block whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium ${
                  active
                    ? "bg-slate-950"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="h-16 md:hidden" />
    </>
  );
}