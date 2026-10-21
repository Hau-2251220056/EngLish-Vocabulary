import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  ChartNoAxesCombined,
  Layers3,
  Mic2,
  MousePointerClick,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import elVocabLogo from "../assets/images/logo.png";
import "./landing-page.css";
import { PublicNavbar } from "./public-navbar.jsx";
import { navigateToLandingSection } from "./section-navigation.js";
import { VocabularyAppPreview } from "./vocabulary-app-preview.jsx";

const features = [
  {
    icon: Search,
    title: "Khám phá bộ từ",
    description: "Tìm bộ từ theo chủ đề và cấp độ phù hợp với mục tiêu học tập của bạn.",
    color: "bg-blue-100/80 text-blue-700",
    surface: "border-blue-200/80 bg-blue-50/60 hover:border-blue-300",
  },
  {
    icon: Layers3,
    title: "Học bằng Flashcard",
    description: "Tập trung vào từng từ với nghĩa tiếng Việt, phiên âm và ví dụ dễ hiểu.",
    color: "bg-violet-100/80 text-violet-700",
    surface: "border-violet-200/80 bg-violet-50/60 hover:border-violet-300",
  },
  {
    icon: Brain,
    title: "Ôn tập theo lịch SRS",
    description: "Củng cố từ vựng theo lịch ôn tập và mức độ ghi nhớ của mỗi từ.",
    color: "bg-amber-100/80 text-amber-700",
    surface: "border-amber-200/80 bg-amber-50/60 hover:border-amber-300",
  },
  {
    icon: BookOpenCheck,
    title: "Quiz trắc nghiệm",
    description: "Luyện tập với các câu hỏi trắc nghiệm rõ ràng, dễ thao tác và bám sát nội dung bạn đang học.",
    color: "bg-emerald-100/80 text-emerald-700",
    surface: "border-emerald-200/80 bg-emerald-50/60 hover:border-emerald-300",
  },
  {
    icon: Mic2,
    title: "Luyện nói",
    description: "Nói từ mẫu và nhận phản hồi nhận dạng giọng nói ngay trong trình duyệt hỗ trợ.",
    color: "bg-cyan-100/80 text-cyan-700",
    surface: "border-cyan-200/80 bg-cyan-50/60 hover:border-cyan-300",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Theo dõi hành trình",
    description: "Xem tiến độ từ vựng, XP, cấp độ và Streak từ hoạt động học đủ điều kiện.",
    color: "bg-rose-100/80 text-rose-700",
    surface: "border-rose-200/80 bg-rose-50/60 hover:border-rose-300",
  },
];

const steps = [
  {
    icon: UserRoundPlus,
    number: "01",
    title: "Tạo tài khoản",
    description: "Đăng ký miễn phí để lưu tiến độ học tập của riêng bạn.",
  },
  {
    icon: MousePointerClick,
    number: "02",
    title: "Chọn bộ từ phù hợp",
    description: "Khám phá bộ từ công khai hoặc tự xây dựng bộ từ cá nhân.",
  },
  {
    icon: Sparkles,
    number: "03",
    title: "Học và ôn tập",
    description: "Kết hợp Flashcard, SRS, trắc nghiệm và luyện nói theo nhịp của bạn.",
  },
];

export function LandingPage() {
  const demoRef = useRef(null);

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-slate-800">
      <PublicNavbar />
      <main>
        <section className="landing-hero-grid relative overflow-hidden px-4 pb-14 pt-16 sm:px-6 sm:pb-18 sm:pt-20 lg:px-8 lg:pb-20 lg:pt-24" aria-labelledby="landing-title">
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
            <div className="absolute left-[8%] top-32 size-20 rounded-full bg-cyan-100/55 blur-2xl" />
            <div className="absolute right-[9%] top-52 size-24 rounded-full bg-blue-100/70 blur-2xl" />
          </div>
          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/85 px-3.5 py-1.5 text-xs font-bold text-[#3d7fbe] shadow-sm backdrop-blur">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Học từ vựng rõ ràng, từng bước một
            </div>
            <h1 id="landing-title" className="landing-headline mt-7 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] font-extrabold tracking-[-0.05em] text-slate-950">
              Làm chủ tiếng Anh
              <span className="landing-headline-emphasis">từng từ một</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Khám phá bộ từ, học bằng Flashcard, ôn tập theo lịch và luyện tập trong một trải nghiệm thân thiện, tập trung.
            </p>
            <div className="mt-8 grid w-full grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] items-stretch justify-center gap-2 sm:w-auto sm:grid-cols-2 sm:gap-3" data-testid="hero-cta-row">
              <Link
                to="/register"
                className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#4b8ccc] px-2.5 text-xs font-bold text-white no-underline shadow-[0_12px_28px_rgb(75_140_204/25%)] transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-[#3978b6] hover:shadow-[0_16px_34px_rgb(75_140_204/31%)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6] focus-visible:ring-offset-2 sm:gap-2 sm:px-6 sm:text-sm motion-reduce:transform-none motion-reduce:transition-none"
              >
                Bắt đầu miễn phí
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href="#san-pham-demo"
                onClick={(event) => navigateToLandingSection(event, "#san-pham-demo")}
                className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 no-underline shadow-sm transition-[border-color,background-color,color] hover:border-blue-200 hover:bg-blue-50 hover:text-[#3d7fbe] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6] sm:px-6 sm:text-sm motion-reduce:transition-none"
              >
                Xem demo
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 sm:text-sm">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />Đăng ký miễn phí</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />Tiến độ riêng theo tài khoản</span>
            </div>
          </div>
        </section>

        <VocabularyAppPreview ref={demoRef} />

        <section id="tinh-nang" tabIndex={-1} className="scroll-mt-24 bg-[#f8faff] px-4 py-20 outline-none sm:px-6 lg:px-8 lg:py-28" aria-labelledby="features-title">
          <div className="mx-auto max-w-[1120px]">
            <SectionHeading
              eyebrow="Tính năng"
              title="Nhiều cách luyện tập, cùng một hành trình"
              description="Mỗi công cụ tập trung vào một phần cụ thể của việc học từ vựng, không thêm các lời hứa hay chỉ số ngoài khả năng hiện có của ELVocab."
              titleId="features-title"
            />
            <div className="mt-12 grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-3" data-testid="feature-grid">
              {features.map(({ icon: Icon, title, description, color, surface }) => (
                <article key={title} className={`group flex h-full min-w-0 flex-col rounded-2xl border p-3 shadow-[0_8px_24px_rgb(30_41_59/5%)] transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgb(30_41_59/8%)] sm:p-5 lg:p-6 motion-reduce:transform-none motion-reduce:transition-none ${surface}`}>
                  <span className={`grid size-10 place-items-center rounded-xl sm:size-12 sm:rounded-2xl ${color}`}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 min-h-10 text-sm font-bold leading-5 tracking-tight text-slate-900 sm:mt-5 sm:text-lg sm:leading-6 lg:min-h-0">{title}</h3>
                  <p className="mt-2 text-[0.7rem] leading-[1.45] text-slate-600 sm:text-sm sm:leading-6">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cach-hoat-dong" tabIndex={-1} className="scroll-mt-24 px-4 py-20 outline-none sm:px-6 lg:px-8 lg:py-28" aria-labelledby="steps-title">
          <div className="mx-auto max-w-[1050px]">
            <SectionHeading
              eyebrow="Cách hoạt động"
              title="Bắt đầu chỉ với ba bước"
              description="Chọn nội dung phù hợp và xây dựng nhịp học của riêng bạn."
              titleId="steps-title"
            />
            <ol className="relative mt-14 grid gap-8 lg:grid-cols-3" data-testid="step-list">
              <div className="absolute left-[16.66%] right-[16.66%] top-10 hidden border-t-2 border-dashed border-blue-100 lg:block" data-testid="desktop-step-connector" aria-hidden="true" />
              {steps.map(({ icon: Icon, number, title, description }, index) => (
                <li key={number} className="relative flex flex-col items-center text-center">
                  {index < steps.length - 1 && (
                    <div
                      className={`pointer-events-none absolute top-10 h-[calc(100%+2rem)] border-y border-dashed border-[#63A0E0]/70 lg:hidden ${index === 0 ? "left-[calc(50%+2.5rem)] right-[calc(50%-7.75rem)] border-r min-[375px]:right-[calc(50%-8.25rem)] sm:right-[calc(50%-10.75rem)]" : "left-[calc(50%-7.75rem)] right-[calc(50%+2.5rem)] border-l min-[375px]:left-[calc(50%-8.25rem)] sm:left-[calc(50%-10.75rem)]"}`}
                      data-testid="mobile-step-connector"
                      data-direction={index === 0 ? "right" : "left"}
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative z-10 grid size-20 place-items-center rounded-3xl border-8 border-white bg-blue-50 text-[#4b8ccc] shadow-[0_8px_24px_rgb(99_160_224/16%)]" data-testid="step-icon">
                    <Icon className="size-6" aria-hidden="true" />
                    <span className="absolute -right-3 -top-3 grid size-7 place-items-center rounded-full bg-[#4b8ccc] text-[0.65rem] font-extrabold text-white">{number}</span>
                  </div>
                  <h3 className="relative z-10 mt-5 text-lg font-bold text-slate-900">{title}</h3>
                  <p className="relative z-10 mt-2 max-w-56 text-sm leading-6 text-slate-600 min-[375px]:max-w-[15rem] sm:max-w-xs">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28" aria-labelledby="final-cta-title">
          <div className="landing-final-cta relative mx-auto max-w-[1120px] overflow-hidden rounded-[2rem] px-6 py-14 text-center text-white shadow-[0_24px_60px_rgb(67_137_200/25%)] sm:px-12 sm:py-16">
            <div className="absolute -left-16 -top-20 size-52 rounded-full border-[2rem] border-white/5" aria-hidden="true" />
            <div className="absolute -bottom-24 -right-12 size-64 rounded-full bg-white/5" aria-hidden="true" />
            <div className="relative mx-auto max-w-2xl">
              <h2 id="final-cta-title" className="text-3xl font-extrabold tracking-tight sm:text-4xl">Sẵn sàng học từ vựng theo cách rõ ràng hơn?</h2>
              <p className="mt-4 text-sm leading-7 text-blue-50 sm:text-base">Tạo tài khoản để chọn bộ từ, bắt đầu luyện tập và theo dõi tiến độ của chính bạn.</p>
              <Link
                to="/register"
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-[#3978b6] no-underline shadow-lg transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#5796d5] motion-reduce:transform-none motion-reduce:transition-none"
              >
                Bắt đầu miễn phí
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <div>
            <img className="mx-auto h-9 w-auto sm:mx-0" src={elVocabLogo} alt="ELVocab" />
            <p className="mt-2 text-xs text-slate-500">Học từ vựng tiếng Anh từng bước, theo nhịp của bạn.</p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm" aria-label="Liên kết cuối trang">
            <Link className="rounded-md text-slate-600 no-underline hover:text-[#3978b6] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6]" to="/topics">Khám phá bộ từ</Link>
            <Link className="rounded-md text-slate-600 no-underline hover:text-[#3978b6] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6]" to="/login">Đăng nhập</Link>
            <Link className="rounded-md text-slate-600 no-underline hover:text-[#3978b6] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6]" to="/register">Đăng ký</Link>
          </nav>
          <p className="text-xs text-slate-500">© 2026 ELVocab</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, titleId }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-extrabold tracking-[0.14em] text-[#4b8ccc] uppercase">{eyebrow}</p>
      <h2 id={titleId} className="mt-3 text-3xl font-extrabold tracking-[-0.035em] text-slate-950 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
    </div>
  );
}
