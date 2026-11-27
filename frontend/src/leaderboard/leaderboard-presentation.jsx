import { ChevronLeft, ChevronRight, Crown, Flame, Medal, Trophy, UserCheck } from "lucide-react";

const numbers = new Intl.NumberFormat("vi-VN", { useGrouping: "always" });
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700";
const avatarSizes = {
  md: "size-8 text-xs sm:size-10 sm:text-sm",
  lg: "size-12 text-base",
  podium: "size-10 text-xs md:size-12 md:text-base",
  podiumLeader: "size-11 text-sm md:size-14 md:text-lg",
};
const avatarColors = [
  "bg-sky-100 text-sky-700 border-sky-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-rose-100 text-rose-800 border-rose-200",
];
const podiumThemes = {
  1: {
    card: "bg-amber-50/50 border-amber-300 shadow-sm",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    ring: "ring-amber-300",
    xp: "text-amber-700",
    medal: "bg-amber-100 border-amber-300 text-amber-700",
  },
  2: {
    card: "bg-white border-slate-300 shadow-xs",
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    ring: "ring-slate-200",
    xp: "text-slate-700",
    medal: "bg-slate-100 border-slate-300 text-slate-700",
  },
  3: {
    card: "bg-orange-50/35 border-orange-200 shadow-xs",
    badge: "bg-orange-100 text-orange-800 border-orange-300",
    ring: "ring-orange-200",
    xp: "text-orange-700",
    medal: "bg-orange-100 border-orange-300 text-orange-800",
  },
};

function LearnerAvatar({ name, size = "md" }) {
  const label = name.normalize("NFC").trim().replace(/\s+/gu, " ");
  const safeLabel = label.toLocaleLowerCase("vi");
  const words = label.match(/(?:\p{L}\p{M}*)+/gu) ?? [];
  const neutral = !words.length || /^(?:học viên(?: \d+)?|bạn)$/u.test(safeLabel);
  const letters = (word) => word.match(/\p{L}\p{M}*/gu);
  const initials = neutral ? "HV" : (words.length === 1
    ? letters(words[0]).slice(0, 2)
    : words.slice(-2).map((word) => letters(word)[0])).join("").toLocaleUpperCase("vi");
  let hash = 0;
  for (const char of safeLabel) hash = (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0;
  const color = neutral ? "bg-slate-100 text-slate-600 border-slate-200" : avatarColors[hash % avatarColors.length];
  return <span aria-hidden="true" className={`${avatarSizes[size]} ${color} flex shrink-0 select-none items-center justify-center rounded-full border font-semibold`}>{initials}</span>;
}

function Xp({ value }) {
  return <>{numbers.format(value)}{"\u00A0"}XP</>;
}

function Streak({ days, pill = "" }) {
  const positive = days > 0;
  return <span className={`inline-flex min-w-0 items-center gap-1 font-medium text-slate-700 tabular-nums ${pill}`}>
    <Flame aria-hidden="true" className={`size-3.5 shrink-0 sm:size-4 ${positive ? "fill-orange-500 text-orange-500" : "text-slate-400"}`} />
    <span className="wrap-anywhere">{numbers.format(days)} ngày</span>
  </span>;
}

function YouBadge() {
  return <span className="w-fit shrink-0 rounded-full border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Bạn</span>;
}

export function PersonalRankCard({ learner, onJump, disabled }) {
  return <section aria-labelledby="personal-rank-title" className="rounded-2xl border border-sky-200 bg-sky-50/75 p-4 shadow-xs sm:p-5">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div className="flex min-w-0 items-center gap-3.5">
        <LearnerAvatar name={learner.display_name} size="lg" />
        <div className="min-w-0">
          <h2 id="personal-rank-title" className="text-xs font-semibold text-sky-700">Thứ hạng của bạn</h2>
          <p className="text-base font-bold text-slate-900 wrap-anywhere sm:text-lg">{learner.display_name}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 md:justify-end">
        <div className="flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white px-3 py-1.5">
          <span className="text-xs text-slate-500">Hạng</span>
          <span className="font-extrabold text-sky-700 tabular-nums">{learner.rank === null ? "Chưa xếp hạng" : `#${numbers.format(learner.rank)}`}</span>
        </div>
        <div className="rounded-xl border border-sky-200/90 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 tabular-nums">
          <Xp value={learner.xp} />
        </div>
        <Streak days={learner.current_streak} pill={`rounded-xl border bg-white px-3 py-1.5 text-sm ${learner.current_streak > 0 ? "border-orange-200/80" : "border-slate-200"}`} />
        {learner.page !== null && <button type="button" onClick={onJump} disabled={disabled}
          className={`inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-700 active:bg-sky-800 disabled:cursor-default disabled:opacity-50 sm:w-auto ${focus}`}>
          <UserCheck aria-hidden="true" className="size-4 shrink-0" /> Xem vị trí của tôi
        </button>}
      </div>
    </div>
  </section>;
}

function PodiumCard({ learner, slot, firstEntry }) {
  const { rank } = learner;
  const style = podiumThemes[rank];
  const isLeading = rank === 1;
  return <li className={`${slot} ${style.card} ${isLeading ? "md:px-5 md:py-6" : "md:px-4 md:py-5"} ${firstEntry ? "max-md:pt-3" : ""} ${learner.is_me ? "ring-2 ring-sky-400" : ""} relative flex min-w-0 flex-col items-center rounded-2xl border px-1.5 py-2 text-center`}>
    {isLeading && <span className="mb-1 inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-amber-800 md:mb-2 md:gap-1 md:px-2.5 md:text-xs">
      <Crown aria-hidden="true" className="size-3 fill-amber-400 text-amber-600 md:size-3.5" /> Dẫn đầu
    </span>}
    <div className="relative mb-1.5 md:mb-2.5">
      <div className={`rounded-full p-0.5 ring-2 ${style.ring}`}>
        <LearnerAvatar name={learner.display_name} size={isLeading ? "podiumLeader" : "podium"} />
      </div>
      <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap tabular-nums md:px-2 md:text-[11px] ${style.badge}`}>
        <span className="sr-only">Hạng </span><span aria-hidden="true">#</span>{numbers.format(rank)}
      </span>
    </div>
    <div className="mt-1.5 flex min-w-0 max-w-full items-center justify-center gap-0.5 md:flex-wrap md:gap-1.5 md:px-1">
      <p className={`min-w-0 text-xs font-semibold text-slate-900 max-md:truncate md:wrap-anywhere ${isLeading ? "md:text-base" : "md:text-sm"}`}>{learner.display_name}</p>
      {learner.is_me && <YouBadge />}
    </div>
    <p className={`mt-0.5 max-w-full text-xs font-bold tabular-nums max-md:wrap-anywhere md:mt-1 ${style.xp} ${isLeading ? "md:text-lg" : "md:text-base"}`}><Xp value={learner.xp} /></p>
    <Streak days={learner.current_streak} pill={`mt-1 max-w-full rounded-full border px-1.5 py-0.5 text-[10px] max-md:gap-0.5 max-md:[&>svg]:size-3 md:mt-2 md:px-2.5 md:py-1 md:text-xs ${learner.current_streak > 0 ? "border-orange-200/80 bg-orange-50" : "border-slate-200 bg-slate-50"}`} />
  </li>;
}

const podiumSlots = ["order-2", "order-1", "order-3"];

export function TopPodium({ learners }) {
  if (learners.length === 0) return null;
  const columns = learners.length === 3 ? "grid-cols-3"
    : learners.length === 2 ? "mx-auto grid-cols-2 max-w-2xl" : "mx-auto max-w-36 grid-cols-1 md:max-w-sm";
  return <section aria-label="Top 3 người học dẫn đầu">
    <ul className={`grid items-end gap-2 md:gap-4 ${columns}`}>
      {learners.map((learner, index) => <PodiumCard key={learner.position} learner={learner} slot={learners.length === 3 ? podiumSlots[index] : ""} firstEntry={index === 0} />)}
    </ul>
  </section>;
}

function RankIndicator({ rank }) {
  const style = podiumThemes[rank];
  const Icon = rank === 1 ? Trophy : Medal;
  return <span className={`inline-flex max-w-full items-center gap-0.5 font-bold tabular-nums sm:gap-1.5 ${style?.xp ?? "text-slate-600"}`}>
    {style && <span className={`grid size-5 shrink-0 place-items-center rounded-full border min-[390px]:size-6 sm:size-7 ${style.medal}`}>
      <Icon aria-hidden="true" className={`size-3 sm:size-3.5 ${rank === 1 ? "fill-amber-500" : ""}`} />
    </span>}
    <span className="wrap-anywhere">{numbers.format(rank)}</span>
  </span>;
}

export function RankingTable({ data, page, previousPeriod, onPage, titleRef, currentRowRef }) {
  return <section aria-labelledby="leaderboard-list-title" className="rounded-2xl border border-slate-200 bg-white shadow-xs">
    <h2 id="leaderboard-list-title" ref={titleRef} tabIndex={-1}
      className="sr-only focus:not-sr-only focus:px-4 focus:py-2">Danh sách xếp hạng</h2>
    {!previousPeriod && data.pagination.page !== page && <p className="px-4 py-2 text-sm text-slate-600">
      Đang hiển thị dữ liệu trang {numbers.format(data.pagination.page)}.
    </p>}
    {data.items.length === 0 ? <div className="p-8 text-center sm:p-12">
      <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-500">
        <Trophy aria-hidden="true" className="size-8" />
      </div>
      <p className="text-base font-bold text-slate-900 sm:text-lg">Chưa có dữ liệu xếp hạng trong kỳ này</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">Chưa có người học nào ghi nhận XP trong khoảng thời gian này.</p>
    </div> : <table aria-labelledby="leaderboard-list-title" className="w-full table-fixed border-separate border-spacing-0 text-left text-xs sm:text-sm">
      <thead>
        <tr className="bg-slate-50/80 text-[10px] font-semibold text-slate-600 uppercase tracking-wider sm:text-xs">
          <th scope="col" className="w-11 rounded-tl-2xl border-b border-slate-200 py-3.5 pr-1 pl-2 min-[390px]:w-14 sm:w-20 sm:pl-6">Hạng</th>
          <th scope="col" className="border-b border-slate-200 px-1 py-3.5 sm:px-4">Người học</th>
          <th scope="col" className="w-[21%] border-b border-slate-200 px-1 py-3.5 text-right sm:w-[22%] sm:px-4">XP</th>
          <th scope="col" className="w-[22%] rounded-tr-2xl border-b border-slate-200 py-3.5 pr-2 pl-1 text-right sm:w-32 sm:pr-6">Chuỗi học</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((learner) => <tr key={learner.position} ref={learner.is_me ? currentRowRef : null}
          tabIndex={learner.is_me ? -1 : undefined}
          className={`outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-sky-600 ${learner.is_me ? "bg-sky-50/85" : "even:bg-slate-50/55 hover:bg-slate-50/80"}`}>
          <td className={`border-b border-l-4 border-b-slate-100 py-3.5 pr-1 pl-1 sm:pl-5 ${learner.is_me ? "border-l-sky-500" : "border-l-transparent"}`}>
            <RankIndicator rank={learner.rank} />
          </td>
          <td className="border-b border-slate-100 px-1 py-3.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
              <LearnerAvatar name={learner.display_name} />
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className={`min-w-0 wrap-anywhere ${learner.is_me ? "font-bold text-slate-900" : "font-medium text-slate-800"}`}>{learner.display_name}</span>
                {learner.is_me && <YouBadge />}
              </div>
            </div>
          </td>
          <td className={`border-b border-slate-100 px-1 py-3.5 text-right font-semibold wrap-anywhere tabular-nums sm:px-4 ${learner.is_me ? "text-sky-700" : "text-slate-800"}`}>
            <Xp value={learner.xp} />
          </td>
          <td className="border-b border-slate-100 py-3.5 pr-2 pl-1 text-right sm:pr-6">
            <Streak days={learner.current_streak} />
          </td>
        </tr>)}
      </tbody>
    </table>}
    <Pagination data={data} page={page} disabled={previousPeriod} onPage={onPage} />
  </section>;
}

function pageWindow(page, count) {
  if (count <= 5) return Array.from({ length: count }, (_, index) => index + 1);
  const inner = Math.min(Math.max(page, 3), count - 2);
  return [1, ...(inner > 3 ? ["before"] : []), inner - 1, inner, inner + 1,
    ...(inner < count - 2 ? ["after"] : []), count];
}

function Pagination({ data, page, disabled, onPage }) {
  const { page: displayedPage, page_size: pageSize, total_items: total, total_pages: totalPages } = data.pagination;
  const count = Math.max(1, totalPages);
  const start = (displayedPage - 1) * pageSize + 1;
  const end = start + data.items.length - 1;
  const control = `inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-default disabled:opacity-45 sm:text-sm ${focus}`;
  return <div className="flex flex-col justify-between gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50/70 px-3 py-3.5 sm:px-6 xl:flex-row xl:items-center">
    <p className="text-xs text-slate-600 sm:text-sm">
      Hiển thị <strong className="text-slate-900">{data.items.length ? `${numbers.format(start)}–${numbers.format(end)}` : "0"}</strong>
      {" trong tổng số "}<strong className="text-slate-900">{numbers.format(total)}</strong> người học
      <span aria-hidden="true" className="mx-1.5 text-slate-400">•</span>
      Trang <strong className="text-slate-900">{numbers.format(page)}</strong> / {numbers.format(count)}
    </p>
    <nav aria-label="Phân trang bảng xếp hạng" className="flex flex-wrap items-center justify-center gap-1 sm:justify-start xl:justify-end">
      <button type="button" aria-label="Trang trước" className={`${control} sm:px-3`} disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft aria-hidden="true" className="size-4" /><span className="sr-only sm:not-sr-only">Trước</span>
      </button>
      {pageWindow(page, count).map((item) => typeof item === "string"
        ? <span aria-hidden="true" key={item} className="px-0.5 text-slate-500">…</span>
        : <button type="button" key={item} aria-current={item === page ? "page" : undefined} aria-label={`Trang ${numbers.format(item)}`}
          className={`min-h-11 min-w-11 cursor-pointer rounded-xl border px-1 text-xs font-semibold tabular-nums disabled:cursor-default disabled:opacity-50 sm:text-sm ${focus} ${item === page ? "border-sky-600 bg-sky-600 text-white shadow-xs" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}
          disabled={disabled} onClick={() => onPage(item)}>{numbers.format(item)}</button>)}
      <button type="button" aria-label="Trang sau" className={`${control} sm:px-3`} disabled={disabled || page >= count} onClick={() => onPage(page + 1)}>
        <span className="sr-only sm:not-sr-only">Sau</span><ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  </div>;
}

export function SkeletonLoader() {
  return <div role="status" className="space-y-5 motion-safe:animate-pulse sm:space-y-6">
    <span className="sr-only">Đang tải bảng xếp hạng</span>
    <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50/75 p-4 sm:p-5">
      <div className="flex items-center gap-3.5">
        <div className="size-12 rounded-full bg-slate-200" />
        <div className="space-y-2"><div className="h-3.5 w-28 rounded bg-slate-200" /><div className="h-5 w-32 rounded bg-slate-200" /></div>
      </div>
      <div className="flex flex-wrap gap-2.5"><div className="h-9 w-16 rounded-xl bg-slate-200" /><div className="h-9 w-16 rounded-xl bg-slate-200" />
        <div className="h-9 w-16 rounded-xl bg-slate-200" /><div className="h-11 w-36 rounded-xl bg-slate-200" /></div>
    </div>
    <div aria-hidden="true" className="grid grid-cols-3 items-end gap-2 md:gap-4">
      {podiumSlots.map((slot, index) => <div key={slot} className={`${slot} ${index === 0 ? "min-h-36 md:min-h-56" : "min-h-28 md:min-h-48"} flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 md:gap-3 md:p-4`}>
        <div className="size-10 rounded-full bg-slate-200 md:size-12" /><div className="h-4 w-3/4 max-w-32 rounded bg-slate-200" /><div className="h-4 w-16 max-w-full rounded bg-slate-200" />
      </div>)}
    </div>
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="h-11 border-b border-slate-200 bg-slate-50/80" />
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <div className="h-6 w-6 rounded bg-slate-200" /><div className="size-8 rounded-full bg-slate-200" /><div className="h-4 min-w-0 flex-1 rounded bg-slate-200" />
          <div className="h-4 w-12 rounded bg-slate-200" /><div className="h-4 w-12 rounded bg-slate-200" />
        </div>)}
      </div>
    </div>
  </div>;
}
