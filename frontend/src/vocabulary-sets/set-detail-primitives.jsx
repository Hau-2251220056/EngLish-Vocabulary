import { BookOpen, FileQuestion } from "lucide-react";
import { Link } from "react-router-dom";

export function SetLearningActions({ enabled, returnTo, setId, setName }) {
  return (
    <section className="set-detail-learning mt-4" aria-labelledby="set-detail-learning-title">
      <h2 className="sr-only" id="set-detail-learning-title">Bắt đầu học</h2>
      <div className="set-detail-learning-grid mt-[0.85rem] grid grid-cols-[repeat(2,minmax(10.5rem,13rem))] gap-[0.85rem] max-[800px]:grid-cols-2 max-[480px]:gap-[0.6rem]">
        <LearningCard enabled={enabled} icon={BookOpen} title="Thẻ ghi nhớ" description="Ôn từ vựng theo từng thẻ." to={`/learn/vocabulary-sets/${setId}`} state={{ returnTo }} />
        <LearningCard enabled={enabled} icon={FileQuestion} title="Quiz" description="Kiểm tra kiến thức với bài Quiz." to={`/quiz/vocabulary-sets/${setId}`} state={{ returnTo, setName }} />
      </div>
    </section>
  );
}

export function SetVocabularyPreviewTable({ items }) {
  const headingClasses = "h-[4.25rem] border-b border-[#e8edf5] bg-[var(--bg-subtle)] px-[0.9rem] py-[0.45rem] text-left align-middle text-[0.78rem] font-semibold tracking-[0.01em] text-slate-600 max-[800px]:h-[3.75rem] max-[480px]:text-[0.72rem]";
  const cellClasses = "h-[4.25rem] [overflow-wrap:anywhere] border-b border-[#e8edf5] px-[0.9rem] py-[0.45rem] align-middle font-normal leading-[1.35] text-[#455166] max-[800px]:h-[3.75rem]";
  return (
    <div className="set-detail-table-wrap mt-4 overflow-hidden rounded-[0.8rem] border border-[var(--border-soft)] bg-white shadow-[0_4px_14px_rgb(30_41_59/3%)]">
      <table className="set-detail-table w-full table-fixed border-separate border-spacing-0 text-[0.82rem] max-[480px]:text-[0.76rem]">
        <thead><tr><th className={`${headingClasses} w-[55%]`}>Từ vựng</th><th className={headingClasses}>Phiên âm</th></tr></thead>
        <tbody>{items.map((item) => (
          <tr className="transition-colors duration-150 last:[&_td]:border-b-0 hover:bg-[#fafaff] motion-reduce:transition-none" key={item.id}>
            <td className={cellClasses}><strong className="font-semibold text-[var(--text-primary)]">{item.word}</strong></td>
            <td className={cellClasses}>{item.phonetic || "—"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function LearningCard({ description, enabled, icon: Icon, state, title, to }) {
  const classes = `set-detail-learning-card grid min-h-[8.25rem] content-center justify-items-center gap-[0.35rem] rounded-2xl border bg-white p-4 text-center no-underline shadow-none transition-[border-color,box-shadow,transform] duration-150 first:border-[#cfe7f8] first:[&_.set-detail-learning-icon]:bg-[var(--accent-primary-soft)] first:[&_.set-detail-learning-icon]:text-[var(--accent-primary-pressed)] [&:nth-child(2)]:border-[#e6def8] [&:nth-child(2)_.set-detail-learning-icon]:bg-[var(--accent-violet-soft)] [&:nth-child(2)_.set-detail-learning-icon]:text-[var(--accent-violet)] max-[480px]:min-h-[7.75rem] max-[480px]:px-2 max-[480px]:py-[0.7rem] motion-reduce:transform-none motion-reduce:transition-none ${enabled ? "cursor-pointer hover:-translate-y-0.5 first:hover:border-[#9ccff2] [&:nth-child(2):hover]:border-[#cbbbec] hover:shadow-[0_8px_20px_rgb(30_41_59/7%)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]" : "is-disabled !border-[var(--border-soft)] !bg-[var(--bg-subtle)] text-slate-500 shadow-none"}`;
  const content = <><span className="set-detail-learning-icon grid size-11 shrink-0 place-items-center rounded-full [&_svg]:w-6"><Icon aria-hidden="true" /></span><h3 className="m-0 text-[0.96rem] font-semibold">{title}</h3><p className="m-0 text-[0.83rem] font-normal leading-[1.35] text-slate-500 max-[480px]:hidden">{description}</p>{!enabled ? <small className="mt-[0.1rem] block text-[0.76rem] font-extrabold text-orange-800">Thêm từ vựng để bắt đầu</small> : null}</>;
  return enabled ? <Link className={classes} to={to} state={state}>{content}</Link> : <div className={classes} aria-disabled="true">{content}</div>;
}
