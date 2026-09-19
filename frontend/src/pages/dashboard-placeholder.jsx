import { BookOpenCheck } from "lucide-react";

export function DashboardPlaceholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
          <BookOpenCheck className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Bạn đã đăng nhập thành công. Không gian học tập sẽ được hoàn thiện ở task tiếp theo.
        </p>
      </section>
    </main>
  );
}
