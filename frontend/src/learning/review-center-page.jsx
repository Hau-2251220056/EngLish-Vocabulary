import {
  ArrowRight,
  BookOpenCheck,
  CircleCheckBig,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingIndicator } from "../components/loading-indicator.jsx";
import { learningService } from "../services/learning-service.js";

const ACTION_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 font-extrabold text-white no-underline transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] motion-reduce:transition-none";
const SECONDARY_ACTION_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-extrabold text-slate-700 no-underline transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] motion-reduce:transition-none";
const RETRY_CLASSES =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-extrabold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]";

export function ReviewCenterPage() {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState({ status: "loading", summary: null });
  const loadingFocusRef = useRef(null);
  const retryButtonRef = useRef(null);
  const retryRequestedRef = useRef(false);
  const successFocusRef = useRef(null);

  useEffect(() => {
    let active = true;
    learningService.getReviewCenterSummary().then(
      (summary) => {
        if (active) setState({ status: "success", summary });
      },
      () => {
        if (active) setState({ status: "error", summary: null });
      },
    );
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    if (!retryRequestedRef.current) return;
    if (state.status === "loading") {
      loadingFocusRef.current?.focus({ preventScroll: true });
      return;
    }
    if (state.status === "error") retryButtonRef.current?.focus();
    if (state.status === "success") successFocusRef.current?.focus();
    retryRequestedRef.current = false;
  }, [state.status]);

  const retry = (event) => {
    retryRequestedRef.current = event.detail === 0;
    setState({ status: "loading", summary: null });
    setRequest((value) => value + 1);
  };

  return (
    <section
      className="mx-auto w-full max-w-6xl p-[clamp(1rem,2.5vw,2.5rem)] text-slate-800"
      aria-label="Trung tâm ôn tập"
    >
      <h1 className="sr-only">Ôn tập từ vựng</h1>
      {state.status === "loading" ? <LoadingState focusRef={loadingFocusRef} /> : null}
      {state.status === "error" ? <ErrorState retry={retry} retryButtonRef={retryButtonRef} /> : null}
      {state.status === "success" ? (
        <ReviewSummary focusTargetRef={successFocusRef} summary={state.summary} />
      ) : null}
    </section>
  );
}

function LoadingState({ focusRef }) {
  return (
    <div
      className="grid min-h-52 place-items-center rounded-3xl border border-sky-100 bg-white p-6 text-center shadow-sm"
    >
      <LoadingIndicator focusRef={focusRef} label="Đang tải dữ liệu ôn tập…" variant="centered" />
    </div>
  );
}

function ErrorState({ retry, retryButtonRef }) {
  return (
    <div
      className="rounded-3xl border border-red-200 bg-red-50 p-[clamp(1.25rem,3vw,2rem)] text-red-900"
      role="alert"
    >
      <h2 className="m-0 text-xl">Không thể tải dữ liệu ôn tập</h2>
      <p className="mb-5 mt-2 leading-6">
        Vui lòng kiểm tra kết nối và thử lại. Chúng tôi không hiển thị số liệu
        ước đoán.
      </p>
      <button className={RETRY_CLASSES} ref={retryButtonRef} type="button" onClick={retry}>
        <RefreshCw className="size-4" aria-hidden="true" /> Thử lại
      </button>
    </div>
  );
}

function ReviewSummary({ focusTargetRef, summary }) {
  const sets = summary.sets.filter(({ due_count: dueCount }) => dueCount > 0);
  return (
    <>
      <div className="mb-8 flex flex-col items-start gap-3">
        <section
          className="w-full rounded-2xl border border-[#cfe8f8] bg-[var(--accent-primary-soft)] p-4 shadow-sm sm:max-w-[17rem]"
          aria-labelledby="due-review-title"
        >
          <div className="flex items-center gap-2 text-[var(--accent-primary-pressed)]">
            <Sparkles className="size-4" aria-hidden="true" />
            <h2
              className="m-0 text-sm font-extrabold text-slate-950"
              id="due-review-title"
            >
              Cần ôn hôm nay
            </h2>
          </div>
          <p
            className="mb-0 mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--accent-primary-pressed)]"
            aria-label={`${summary.due_count} từ đến hạn`}
          >
            {summary.due_count}{" "}
            <span className="text-sm font-bold tracking-normal text-slate-600">
              từ đến hạn
            </span>
          </p>
        </section>
      </div>

      {summary.has_due_items
        ? <DueSetList focusTargetRef={focusTargetRef} sets={sets} />
        : <EmptyState focusTargetRef={focusTargetRef} />}
    </>
  );
}

function DueSetList({ focusTargetRef, sets }) {
  return (
    <section aria-labelledby="set-review-title">
      <div className="mb-4">
        <h2
          className="m-0 rounded-sm text-2xl font-extrabold tracking-[-0.02em] text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]"
          id="set-review-title"
          ref={focusTargetRef}
          tabIndex={-1}
        >
          Ôn theo bộ từ
        </h2>
      </div>
      <ul
        className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2"
        aria-label="Các bộ từ cần ôn"
      >
        {sets.map((set) => (
          <DueSetCard key={set.set_id} set={set} />
        ))}
      </ul>
    </section>
  );
}

function DueSetCard({ set }) {
  const scopeLabel =
    set.set_scope === "PUBLIC" ? "Bộ từ công khai" : "Bộ từ cá nhân";
  return (
    <li className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#b8daf2] hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary-pressed)]">
            <BookOpenCheck className="size-5" aria-hidden="true" />
          </span>
          <span className="rounded-full border border-[#cfe8f8] bg-[var(--accent-primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-primary-pressed)]">
            {scopeLabel}
          </span>
        </div>
        <h3 className="m-0 [overflow-wrap:anywhere] text-lg font-extrabold leading-7 text-slate-950">
          {set.name}
        </h3>
        <p className="mb-0 mt-2 text-sm font-bold text-[var(--accent-primary-pressed)]">
          {set.due_count} từ đến hạn
        </p>
      </div>
      <Link
        className={`${ACTION_CLASSES} mt-5 w-full sm:w-auto sm:self-start`}
        to={`/review/sets/${set.set_id}`}
        aria-label={`Ôn tập ngay ${set.name} — ${scopeLabel}`}
      >
        Ôn tập ngay <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </li>
  );
}

function EmptyState({ focusTargetRef }) {
  return (
    <section
      className="rounded-3xl border border-emerald-200 bg-emerald-50 p-[clamp(1.5rem,4vw,2.5rem)] text-center"
      aria-labelledby="review-empty-title"
    >
      <CircleCheckBig
        className="mx-auto size-12 text-emerald-600"
        aria-hidden="true"
      />
      <h2
        className="mb-0 mt-4 rounded-sm text-2xl text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        id="review-empty-title"
        ref={focusTargetRef}
        tabIndex={-1}
      >
        Bạn đã ôn xong các từ đến hạn!
      </h2>
      <p className="mb-5 mt-2 text-emerald-900">
        Tiếp tục học để mở rộng vốn từ của bạn.
      </p>
      <Link className={SECONDARY_ACTION_CLASSES} to="/topics">
        Tiếp tục học
      </Link>
    </section>
  );
}
