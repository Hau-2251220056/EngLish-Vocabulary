import { CircleAlert } from "lucide-react";

export function FormAlert({ error }) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900"
    >
      <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-bold">{error.title}</p>
        <p className="mt-0.5 text-sm leading-5 text-red-700">{error.message}</p>
      </div>
    </div>
  );
}
