import { BookOpen, ChevronLeft, ChevronRight, FileQuestion, Mic } from "lucide-react";
import { Link } from "react-router-dom";

export function SetLearningActions({ compactMobile = false, enabled, returnTo, setId, setName }) {
  const mobileGrid = compactMobile ? "max-[480px]:grid-cols-2" : "max-[480px]:grid-cols-1";
  const mobileCard = compactMobile
    ? "max-[480px]:min-h-[6.75rem] max-[480px]:grid-rows-[2.5rem_auto_0_auto] max-[480px]:gap-[0.2rem] max-[480px]:px-2 max-[480px]:py-[0.55rem]"
    : "max-[480px]:min-h-[7.75rem] max-[480px]:grid-rows-[2.75rem_auto_0_auto] max-[480px]:px-2 max-[480px]:py-[0.7rem]";
  return (
    <section className="set-detail-learning mt-4" aria-labelledby="set-detail-learning-title">
      <h2 className="sr-only" id="set-detail-learning-title">Bắt đầu học</h2>
      <div className={`set-detail-learning-grid mt-[0.85rem] grid grid-cols-[repeat(3,minmax(10.5rem,13rem))] gap-[0.85rem] max-[800px]:grid-cols-2 max-[480px]:gap-[0.6rem] ${mobileGrid}`}>
        <LearningCard enabled={enabled} icon={BookOpen} title="Thẻ ghi nhớ" description="Ôn từ vựng theo từng thẻ." mobileClasses={mobileCard} to={`/learn/vocabulary-sets/${setId}`} state={{ returnTo }} />
        <LearningCard enabled={enabled} icon={FileQuestion} title="Quiz" description="Kiểm tra kiến thức với bài Quiz." mobileClasses={mobileCard} to={`/quiz/vocabulary-sets/${setId}`} state={{ returnTo, setName }} />
        <LearningCard enabled={enabled} icon={Mic} title="Luyện nói" description="Nghe từ mẫu và luyện nói." mobileClasses={mobileCard} to={`/pronunciation/vocabulary-sets/${setId}`} state={{ returnTo }} />
      </div>
    </section>
  );
}

export function SetVocabularyPreviewTable({ actionHeader = "Thao tác", items, renderAction }) {
  const headingClasses = "border-b border-[#e8edf5] bg-[var(--bg-subtle)] px-[0.9rem] py-3 text-left align-middle text-[0.78rem] font-semibold tracking-[0.01em] text-slate-600";
  const cellClasses = "[overflow-wrap:anywhere] border-b border-[#e8edf5] px-[0.9rem] py-3 align-top font-normal leading-[1.45] text-[#455166]";
  return (
    <div className={`set-detail-table-wrap public-set-table-wrap mt-4 overflow-x-auto rounded-[0.8rem] border border-[var(--border-soft)] bg-white shadow-[0_4px_14px_rgb(30_41_59/3%)] ${renderAction ? "has-actions" : "is-read-only"}`}>
      <table className="set-detail-table public-set-table w-full table-fixed border-separate border-spacing-0 text-[0.82rem]" aria-label="Bảng từ vựng">
        <thead><tr><th className={`${headingClasses} public-set-word-column`}>Từ vựng</th><th className={`${headingClasses} public-set-meaning-column`}>Nghĩa</th><th className={`${headingClasses} public-set-optional-column public-set-phonetic-column`}>Phiên âm</th><th className={`${headingClasses} public-set-optional-column public-set-example-column`}>Ví dụ</th>{renderAction ? <th className={`${headingClasses} public-set-action-column whitespace-nowrap`}>{actionHeader}</th> : null}</tr></thead>
        <tbody>{items.map((item) => (
          <tr className="transition-colors duration-150 last:[&_td]:border-b-0 hover:bg-[#fafaff] motion-reduce:transition-none" key={item.id}>
            <td className={`${cellClasses} public-set-word-column`}><strong className="font-semibold text-[var(--text-primary)]">{item.word}</strong></td>
            <td className={`${cellClasses} public-set-meaning-column`}>{item.primary_meaning?.meaning_vi || "—"}</td>
            <td className={`${cellClasses} public-set-optional-column public-set-phonetic-column`}>{item.phonetic || "—"}</td>
            <td className={`${cellClasses} public-set-optional-column public-set-example-column`}>{item.primary_meaning?.example?.example_en ? <><span>{item.primary_meaning.example.example_en}</span>{item.primary_meaning.example.example_vi ? <small className="mt-1 block text-[0.75rem] text-slate-500">{item.primary_meaning.example.example_vi}</small> : null}</> : "—"}</td>
            {renderAction ? <td className={`${cellClasses} public-set-action-column relative overflow-visible whitespace-nowrap [&>button]:whitespace-nowrap`}>{renderAction(item)}</td> : null}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function SetDetailPagination({ pagination, pending = false, setPage }) {
  const controlClasses = "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[0.55rem] border border-slate-300 bg-white p-0 text-slate-600 transition-colors duration-150 hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] hover:text-[var(--accent-primary-pressed)] active:bg-slate-100 focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 disabled:opacity-70 motion-reduce:transition-none";
  return (
    <div className="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[0.82rem] text-slate-600">
      <p className="m-0 font-semibold" aria-live="polite">{pagination.start}–{pagination.end} / {pagination.totalItems} từ</p>
      {pagination.totalPages > 1 ? (
        <nav className="flex items-center gap-1" aria-label="Phân trang từ vựng">
          <button type="button" className={controlClasses} aria-label="Trang trước" onClick={() => setPage(Math.max(1, pagination.currentPage - 1))} disabled={pending || pagination.currentPage === 1}>
            <ChevronLeft aria-hidden="true" size={17} strokeWidth={2} />
          </button>
          <span aria-current="page" className="min-w-[4.75rem] whitespace-nowrap text-center font-semibold text-slate-700">Trang {pagination.currentPage} / {pagination.totalPages}</span>
          <button type="button" className={controlClasses} aria-label="Trang sau" onClick={() => setPage(Math.min(pagination.totalPages, pagination.currentPage + 1))} disabled={pending || pagination.currentPage === pagination.totalPages}>
            <ChevronRight aria-hidden="true" size={17} strokeWidth={2} />
          </button>
        </nav>
      ) : null}
    </div>
  );
}

function LearningCard({ description, enabled, icon: Icon, mobileClasses, state, title, to }) {
  const classes = `set-detail-learning-card grid min-h-[8.25rem] grid-rows-[2.75rem_auto_minmax(2.25rem,auto)_auto] content-center justify-items-center gap-[0.35rem] rounded-2xl border-2 bg-white p-4 text-center no-underline shadow-none transition-[border-color,box-shadow,transform] duration-150 first:border-[#93BFF0] first:[&_.set-detail-learning-icon]:bg-[var(--accent-primary-soft)] first:[&_.set-detail-learning-icon]:text-[var(--accent-primary-pressed)] [&:nth-child(2)]:border-[#BCA8EA] [&:nth-child(2)_.set-detail-learning-icon]:bg-[var(--accent-violet-soft)] [&:nth-child(2)_.set-detail-learning-icon]:text-[var(--accent-violet)] [&:nth-child(3)]:border-[#5DDCCB] [&:nth-child(3)_.set-detail-learning-icon]:bg-[#F0FDFA] [&:nth-child(3)_.set-detail-learning-icon]:text-[#0D9488] ${mobileClasses} motion-reduce:transform-none motion-reduce:transition-none ${enabled ? "cursor-pointer hover:-translate-y-0.5 first:hover:border-[#9ccff2] [&:nth-child(2):hover]:border-[#cbbbec] [&:nth-child(3):hover]:border-[#2DD4BF] hover:shadow-[0_8px_20px_rgb(30_41_59/7%)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]" : "is-disabled !border-[var(--border-soft)] !bg-[var(--bg-subtle)] text-slate-500 shadow-none"}`;
  const content = <><span className="set-detail-learning-icon row-start-1 grid size-11 shrink-0 place-items-center rounded-full [&_svg]:w-6"><Icon aria-hidden="true" /></span><h3 className="row-start-2 m-0 text-[0.96rem] font-semibold">{title}</h3><p className="row-start-3 m-0 text-[0.83rem] font-normal leading-[1.35] text-slate-500 max-[480px]:hidden">{description}</p>{!enabled ? <small className="row-start-4 mt-[0.1rem] block text-[0.76rem] font-extrabold text-orange-800">Thêm từ vựng để bắt đầu</small> : null}</>;
  return enabled ? <Link className={classes} to={to} state={state}>{content}</Link> : <div className={classes} aria-disabled="true">{content}</div>;
}
