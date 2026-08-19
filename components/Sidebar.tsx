"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type MouseEvent } from "react";

import { logout } from "@/app/auth-actions";

const items = [
  { href: "/", label: "Hoy" },
  { href: "/trabajo-autonomo", label: "Repaso diario" },
  { href: "/horario", label: "Horario semanal" },
  { href: "/calendario", label: "Calendario mensual" },
  { href: "/ramos", label: "Mis ramos" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);

  function openLogoutDialog() {
    dialogRef.current?.showModal();
  }

  function closeLogoutDialog() {
    dialogRef.current?.close();
  }

  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      closeLogoutDialog();
    }
  }

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

          <button
            ref={logoutButtonRef}
            type="button"
            onClick={openLogoutDialog}
            className="block w-full whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
        </nav>
      </aside>

      <div className="h-16 md:hidden" />

      <dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        onClick={closeOnBackdrop}
        onClose={() => logoutButtonRef.current?.focus()}
        className="fixed inset-0 z-[100] m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 text-slate-950 shadow-xl backdrop:bg-slate-950/35"
      >
        <div className="p-6">
          <h2 id="logout-dialog-title" className="text-xl font-semibold">
            ¿Seguro que quieres cerrar sesión?
          </h2>

          <p
            id="logout-dialog-description"
            className="mt-2 text-sm leading-6 text-slate-600"
          >
            Podrás volver a iniciar sesión cuando quieras.
          </p>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              autoFocus
              onClick={closeLogoutDialog}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>

            <form action={logout}>
              <button
                type="submit"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
