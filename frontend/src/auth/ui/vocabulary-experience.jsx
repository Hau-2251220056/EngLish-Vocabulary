import { BookOpen, Sparkles, Volume2 } from "lucide-react";

const VOCABULARY = {
  login: {
    eyebrow: "Từ vựng hôm nay",
    word: "resilient",
    ipa: "/rɪˈzɪl.i.ənt/",
    type: "adjective",
    meaning: "kiên cường, có khả năng phục hồi",
    example: "She stayed resilient through every challenge.",
    fragments: ["re-", "sil", "-ient"],
  },
  register: {
    eyebrow: "Bắt đầu hành trình",
    word: "curious",
    ipa: "/ˈkjʊə.ri.əs/",
    type: "adjective",
    meaning: "tò mò, ham học hỏi",
    example: "A curious mind discovers something new every day.",
    fragments: ["curi", "-ous", "learn"],
  },
};

export function VocabularyExperience({ mode }) {
  const content = VOCABULARY[mode];

  return (
    <section className="vocabulary-panel-surface learning-grid relative flex h-full flex-col justify-between overflow-hidden p-6 text-white md:p-8 lg:p-9">
      <div className="pointer-events-none absolute -top-16 -right-12 size-52 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute right-10 bottom-16 size-24 rotate-12 border border-white/10" />

      <div className="relative flex items-center gap-2 text-sm font-bold tracking-wide text-white/90">
        <BookOpen className="size-5" aria-hidden="true" />
        <span>ELVocab</span>
      </div>

      <div className="relative my-6 md:my-auto">
        <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-white/90 uppercase">
          <Sparkles className="size-4" aria-hidden="true" />
          {content.eyebrow}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {content.word}
          </h2>
          <span
            className="flex size-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white"
            aria-hidden="true"
          >
            <Volume2 className="size-5" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/90">
          <span>{content.ipa}</span>
          <span className="rounded-full border border-white/20 px-2.5 py-1 text-xs font-semibold">
            {content.type}
          </span>
        </div>
        <p className="mt-6 text-lg font-semibold text-white">
          {content.meaning}
        </p>
        <p className="mt-2 max-w-md text-sm leading-6 text-white/90 italic">
          “{content.example}”
        </p>
      </div>

      <div className="relative flex items-center justify-between gap-4 border-t border-white/15 pt-4">
        <div className="flex gap-2" aria-label="Các mảnh ghép ngôn ngữ">
          {content.fragments.map((fragment) => (
            <span
              key={fragment}
              className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/90"
            >
              {fragment}
            </span>
          ))}
        </div>
        <span className="hidden text-xs text-white/85 sm:block">
          Learn • Recall • Grow
        </span>
      </div>
    </section>
  );
}
