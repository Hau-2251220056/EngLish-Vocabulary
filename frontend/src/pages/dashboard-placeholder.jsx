import { BookOpenCheck } from "lucide-react";

export function DashboardPlaceholder() {
  return (
    <section
      className="flex min-h-full w-full min-w-0 items-center justify-center px-4 py-10 sm:px-6"
      aria-labelledby="dashboard-title"
    >
      <section className="w-full min-w-0 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
          <BookOpenCheck className="size-6" aria-hidden="true" />
        </span>
        <h1
          id="dashboard-title"
          className="mt-4 text-2xl font-extrabold text-slate-900"
        >
          Dashboard
        </h1>
        <p className="mt-2 break-words text-sm leading-6 text-slate-500">
          Bạn đã đăng nhập thành công. Không gian học tập sẽ được hoàn thiện ở task tiếp theo.
        </p>
      </section>
    </section>
  );
}
