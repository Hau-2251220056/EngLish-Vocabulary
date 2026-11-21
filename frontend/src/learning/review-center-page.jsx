import {
  ArrowRight,
  BookOpenCheck,
  CircleCheckBig,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { LoadingIndicator } from "../components/loading-indicator.jsx";
import { learningService } from "../services/learning-service.js";
import { learningSessionService } from "../services/learning-session-service.js";
import { listStoredStandardSrsSessionIdentities, loadLearningSessionState } from "../session-storage/learning-session-state.js";

const ACTION_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 font-extrabold text-white no-underline transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] motion-reduce:transition-none";
const SECONDARY_ACTION_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-extrabold text-slate-700 no-underline transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] motion-reduce:transition-none";
const RETRY_CLASSES =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-extrabold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]";

export function ReviewCenterPage() {
  const { user } = useAuthentication();
  const [request, setRequest] = useState(0);
  const [state, setState] = useState({ status: "loading", summary: null });
  const [continuations, setContinuations] = useState({ status: "loading", sessions: [] });
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
    let active = true;
    let storage = null;
    try { storage = window.sessionStorage; } catch { /* No same-tab session storage. */ }
    const identities = listStoredStandardSrsSessionIdentities(storage, user.id);
    if (identities.length === 0) {
      void Promise.resolve().then(() => {
        if (active) setContinuations({ status: "ready", sessions: [] });
      });
      return () => { active = false; };
    }
    void Promise.allSettled(identities.map(async (identity) => {
      const stored = loadLearningSessionState(storage, identity);
      if (!stored) throw new TypeError("Stored SRS session is unavailable.");
      return { identity, session: await learningSessionService.readSession(stored.session_id) };
    })).then((results) => {
      if (!active) return;
      const sessions = results.filter((result) => result.status === "fulfilled")
        .map((result) => result.value)
        .filter(({ identity, session }) => session.set_id === identity.setId
          && session.mode === "SRS" && session.session_intent === "STANDARD"
          && session.can_continue && typeof session.set_name === "string");
      setContinuations({ status: results.some((result) => result.status === "rejected") ? "error" : "ready", sessions });
    });
    return () => { active = false; };
  }, [request, user.id]);

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
    setContinuations({ status: "loading", sessions: [] });
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
      {state.status === "success" && continuations.sessions.length > 0 ? (
        <section className="mt-8" aria-labelledby="continue-srs-title">
          <h2 id="continue-srs-title" className="text-xl font-extrabold">Phiên SRS chưa hoàn thành</h2>
          <ul className="list-none space-y-3 p-0">{continuations.sessions.map(({ identity, session }) => (
            <li key={session.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mt-0 font-bold">{session.set_name}</p>
              <Link className={SECONDARY_ACTION_CLASSES} to={`/learn/vocabulary-sets/${identity.setId}`}
                state={{ learningIntent: "CONTINUE_SRS", returnTo: "/review" }}>
                Tiếp tục phiên SRS
              </Link>
            </li>
          ))}</ul>
        </section>
      ) : null}
      {state.status === "success" && continuations.status === "loading" ? (
        <p role="status" className="mt-4 text-sm text-slate-600">Đang kiểm tra phiên SRS chưa hoàn thành…</p>
      ) : null}
      {state.status === "success" && continuations.status === "error" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3" role="alert">
          <p className="m-0 text-sm text-red-800">Không thể kiểm tra tất cả phiên SRS chưa hoàn thành.</p>
          <button className={RETRY_CLASSES} type="button" onClick={retry}>Thử lại</button>
        </div>
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
        : <EmptyState focusTargetRef={focusTargetRef} hasReviewData={summary.has_review_data} />}
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
        <p className="mb-0 mt-1 text-sm leading-5 text-slate-600">
          Mỗi phiên chỉ gồm tối đa 10 từ đã học và đang đến hạn. Sau khi hoàn thành, bạn có thể ôn tiếp các từ còn đến hạn.
        </p>
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
        state={{ learningIntent: "FRESH_DUE_ONLY" }}
        aria-label={`Ôn tập từ đến hạn ${set.name} — ${scopeLabel}`}
      >
        Ôn tập từ đến hạn <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </li>
  );
}

function EmptyState({ focusTargetRef, hasReviewData }) {
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
        {hasReviewData === false ? "Bạn chưa có dữ liệu ôn tập" : "Hiện không có từ đến hạn"}
      </h2>
      <p className="mb-5 mt-2 text-emerald-900">
        {hasReviewData === false
          ? "Hãy bắt đầu học một bộ từ. Các từ đến hạn sẽ xuất hiện tại đây sau khi có tiến độ học."
          : "Tiếp tục học và quay lại khi có từ đến hạn ôn tập."}
      </p>
      <Link className={SECONDARY_ACTION_CLASSES} to="/topics">
        Tiếp tục học
      </Link>
    </section>
  );
}
