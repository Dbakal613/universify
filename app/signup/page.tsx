import Link from "next/link";

import SignupForm from "./signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 pb-24 text-slate-900 md:ml-64 md:pb-10">
      <div className="mx-auto max-w-md">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Universify
          </p>
          <h1 className="mt-2 text-4xl font-bold">Crea tu cuenta</h1>
          <p className="mt-3 text-slate-600">
            Empieza a organizar tus ramos y evaluaciones en un solo lugar.
          </p>
        </header>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <SignupForm />

          <p className="mt-6 text-center text-sm text-slate-600">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-semibold text-slate-950 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
