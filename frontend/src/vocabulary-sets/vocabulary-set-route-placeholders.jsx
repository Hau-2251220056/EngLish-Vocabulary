export function MyVocabularySetsPlaceholder() {
  return <RoutePlaceholder title="Bộ từ của tôi" />;
}

export function AdminVocabularySetsPlaceholder() {
  return <RoutePlaceholder title="Quản lý bộ từ hệ thống" />;
}

function RoutePlaceholder({ title }) {
  return (
    <section className="flex min-h-full w-full items-center justify-center px-4 py-10" aria-labelledby="vocabulary-set-route-title">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 id="vocabulary-set-route-title" className="text-2xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Nội dung sẽ được hoàn thiện ở bước tiếp theo.</p>
      </div>
    </section>
  );
}
