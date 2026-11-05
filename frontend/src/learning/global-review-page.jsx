import { ArrowLeft, BookOpenCheck, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LearningApiError, learningService } from "../services/learning-service.js";
import { learningSessionService } from "../services/learning-session-service.js";
import { selectPrimaryMeaning } from "./learning-presentation.js";
import {
  applyGlobalReviewRating,
  clearGlobalReviewState,
  createGlobalReviewQueue,
  createReviewSessionWithReplay,
  loadGlobalReviewState,
  saveGlobalReviewState,
  submitReviewRatingWithReplay,
} from "./global-review-session.js";

const RATINGS = [["AGAIN", "Lại"], ["HARD", "Khó"], ["GOOD", "Tốt"], ["EASY", "Dễ"]];
const BUTTON = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-extrabold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60";

export function GlobalReviewPage() {
  const [status, setStatus] = useState("loading");
  const [session, setSession] = useState(null);
  const [cards, setCards] = useState([]);
  const [queue, setQueue] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState(null);
  const [nearestFuture, setNearestFuture] = useState(null);
  const [requestToken, setRequestToken] = useState(0);
  const [pendingRating, setPendingRating] = useState(null);
  const [cardTransitionVersion, setCardTransitionVersion] = useState(0);
  const cardButtonRef = useRef(null);

  useEffect(() => {
    let active = true;
    const storage = browserStorage();
    const stored = loadGlobalReviewState(storage);
    const restore = stored
      ? learningSessionService.readSession(stored.session_id).then((projection) => ({
        session: projection, cards: stored.cards,
        queue: projection.state === "COMPLETED" ? [] : stored.queue.filter((id) => (
          projection.items.some((item) => item.vocabulary_id === id && item.evidence === null)
        )),
      }))
      : createReviewSessionWithReplay({ storage, service: learningService, randomUuid: randomUuid })
        .then((result) => result.session === null ? result : ({
          ...result, queue: createGlobalReviewQueue(result.session),
        }));
    void restore.then((result) => {
      if (!active) return;
      if (result.session === null) {
        setNearestFuture(result.nearest_future_review_at ?? null);
        setStatus(result.reason === "REVIEW_FUTURE_DUE" ? "future" : "empty");
        return;
      }
      if (result.session.scope !== "GLOBAL") throw new TypeError("Global review restored a non-global session.");
      if (result.session.restart_reason === "SESSION_INACCESSIBLE") {
        setStatus("inaccessible");
        return;
      }
      if (result.session.state === "EXPIRED") {
        setStatus("expired");
        return;
      }
      const nextQueue = result.queue ?? createGlobalReviewQueue(result.session);
      setSession(result.session); setCards(result.cards); setQueue(nextQueue);
      saveGlobalReviewState(storage, { session_id: result.session.id, cards: result.cards, queue: nextQueue });
      setStatus(result.session.state === "COMPLETED" ? "complete" : "ready");
      queueMicrotask(() => cardButtonRef.current?.focus());
    }).catch((reason) => {
      if (!active) return;
      if (reason?.code === "LEARNING_SESSION_EXPIRED") setStatus("expired");
      else if (reason?.code === "LEARNING_SESSION_INACCESSIBLE") setStatus("inaccessible");
      else { setError("Không thể tải phiên ôn tập toàn cục. Vui lòng thử lại."); setStatus("error"); }
    });
    return () => { active = false; };
  }, [requestToken]);

  const currentId = queue[0] ?? null;
  const currentCard = cards.find(({ id }) => id === currentId) ?? null;
  const meaning = useMemo(() => selectPrimaryMeaning(currentCard?.meanings), [currentCard]);
  const resolvedCount = session ? session.snapshot_size - new Set(queue).size : 0;

  useEffect(() => {
    if (status === "ready" && currentId) queueMicrotask(() => cardButtonRef.current?.focus());
  }, [cardTransitionVersion, currentId, status]);

  async function rate(rating) {
    if (!currentCard || !session || pendingRating) return;
    setPendingRating(rating); setError(null);
    try {
      const accepted = await submitReviewRatingWithReplay({
        storage: browserStorage(), service: learningService, randomUuid,
        request: { set_id: null, vocabulary_id: currentCard.id, expected_revision: currentCard.progress.revision, rating, session_id: session.id },
      });
      const nextCards = cards.map((card) => card.id === currentCard.id
        ? { ...card, progress: { ...card.progress, ...accepted } } : card);
      const nextQueue = applyGlobalReviewRating(queue, currentCard.id, rating);
      setSession(accepted.session); setCards(nextCards); setQueue(nextQueue); setRevealed(false);
      setCardTransitionVersion((value) => value + 1);
      saveGlobalReviewState(browserStorage(), { session_id: accepted.session.id, cards: nextCards, queue: nextQueue });
      if (accepted.session.state === "COMPLETED") setStatus("complete");
    } catch (reason) {
      if (reason instanceof LearningApiError && reason.code === "LEARNING_SESSION_EXPIRED") setStatus("expired");
      else if (reason instanceof LearningApiError && reason.code === "LEARNING_SESSION_INACCESSIBLE") setStatus("inaccessible");
      else setError("Chưa thể ghi nhận đánh giá. Hãy thử lại đúng thao tác này.");
    } finally { setPendingRating(null); }
  }

  function freshReview() {
    clearGlobalReviewState(browserStorage());
    setSession(null); setCards([]); setQueue([]); setRevealed(false); setError(null); setStatus("loading");
    setRequestToken((value) => value + 1);
  }

  if (status !== "ready") return <ReviewState status={status} error={error} nearestFuture={nearestFuture} onRetry={freshReview} />;
  if (!currentCard) return <ReviewState status="error" error="Phiên ôn tập không còn thẻ hợp lệ." onRetry={freshReview} />;

  return (
    <main className="mx-auto grid min-h-[calc(100vh_-_7rem)] w-full max-w-3xl place-items-center p-[clamp(1rem,4vw,2rem)] text-slate-800" aria-labelledby="global-review-title">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-[clamp(1rem,4vw,2rem)] shadow-[var(--shadow-md)]">
        <div className="mb-5 flex items-center justify-between gap-3"><Link className={BUTTON} to="/dashboard"><ArrowLeft aria-hidden="true" /> Dashboard</Link><strong aria-live="polite">{resolvedCount} / {session.snapshot_size}</strong></div>
        <progress className="mb-6 h-2 w-full accent-[var(--accent-primary)]" max={session.snapshot_size} value={resolvedCount}>{resolvedCount}/{session.snapshot_size}</progress>
        <button className="min-h-52 w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]" type="button" onClick={() => setRevealed((value) => !value)} aria-pressed={revealed} ref={cardButtonRef}>
          <h1 className="m-0 text-[clamp(2rem,7vw,4rem)]" id="global-review-title">{revealed ? meaning?.meaning_vi ?? "Chưa có nghĩa" : currentCard.word}</h1>
          <p className="mb-0 mt-3 text-sm text-slate-500">{revealed ? "Chọn mức độ ghi nhớ" : "Nhấn để lật thẻ"}</p>
        </button>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-red-800" role="alert">{error}</p> : null}
        <div className="mt-5 grid grid-cols-4 gap-2 max-[560px]:grid-cols-2" role="group" aria-label="Đánh giá SRS">
          {RATINGS.map(([rating, label]) => <button className={BUTTON} type="button" key={rating} disabled={!revealed || Boolean(pendingRating)} onClick={() => void rate(rating)} aria-busy={pendingRating === rating}>{pendingRating === rating ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{label}</button>)}
        </div>
      </section>
    </main>
  );
}

function ReviewState({ status, error, nearestFuture, onRetry }) {
  const content = {
    loading: ["Đang chuẩn bị ôn tập", "Backend đang chọn tối đa 10 từ đến hạn."],
    complete: ["Hoàn thành phiên ôn tập", "Ảnh chụp cố định hiện tại đã được giải quyết."],
    empty: ["Bạn đã ôn tập đầy đủ", "Hiện không có từ phù hợp đến hạn."],
    future: ["Chưa có từ đến hạn", nearestFuture ? `Lần ôn gần nhất: ${formatDate(nearestFuture)}.` : "Hãy quay lại sau."],
    expired: ["Phiên ôn tập đã hết hạn", "Hãy yêu cầu một phiên mới để tiếp tục."],
    inaccessible: ["Nội dung không còn truy cập được", "Phiên dừng an toàn và không tiết lộ nội dung đã mất quyền truy cập."],
    error: ["Không thể mở ôn tập toàn cục", error ?? "Vui lòng thử lại."],
  }[status];
  const canContinue = status === "complete";
  const canRestart = ["expired", "inaccessible"].includes(status);
  return <main className="mx-auto grid min-h-[calc(100vh_-_7rem)] w-full max-w-2xl place-items-center p-4"><section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center" role={status === "loading" ? "status" : status === "error" ? "alert" : "status"}><BookOpenCheck className="mx-auto size-14 text-[var(--accent-primary)]" aria-hidden="true" /><h1>{content[0]}</h1><p>{content[1]}</p><div className="flex flex-wrap justify-center gap-3">{status === "error" ? <button className={BUTTON} type="button" onClick={onRetry}>Thử lại</button> : null}{canContinue ? <button className={BUTTON} type="button" onClick={onRetry}><RotateCcw aria-hidden="true" /> Ôn tiếp</button> : null}{canRestart ? <button className={BUTTON} type="button" onClick={onRetry}><RotateCcw aria-hidden="true" /> Tạo phiên mới</button> : null}<Link className={BUTTON} to="/dashboard">Dashboard</Link></div></section></main>;
}

function randomUuid() { return window.crypto.randomUUID(); }
function browserStorage() { try { return window.sessionStorage; } catch { return null; } }
function formatDate(value) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
