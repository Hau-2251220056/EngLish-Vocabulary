import { Download, ExternalLink, Info } from "lucide-react";

const SOURCE_LINK_CLASSES = "inline-flex min-h-11 items-center gap-1.5 rounded-md font-semibold text-[#075f95] underline decoration-sky-300 underline-offset-4 hover:text-[#064d78] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sky-200";

export function DataSourcesPage() {
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-6 text-[#172554] sm:px-6 sm:py-8" aria-labelledby="data-sources-title">
      <header className="border-b border-sky-200 pb-6">
        <h1 className="m-0 max-w-3xl text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-tight tracking-[-0.025em] text-slate-950" id="data-sources-title">
          Nguồn dữ liệu &amp; Giấy phép
        </h1>
        <p className="mb-0 mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
          ELVocab là đồ án tốt nghiệp giáo dục phi thương mại. Dữ liệu được chọn lọc từ các nguồn dưới đây, sau đó được biên tập để hỗ trợ người học tiếng Anh bằng tiếng Việt.
        </p>
      </header>

      <aside className="my-6 flex gap-3 border-l-4 border-amber-400 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950" aria-label="Lưu ý về phạm vi cấp phép">
        <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p className="m-0">Trang này ghi nhận nguồn và phạm vi sử dụng hiện tại; không tuyên bố ELVocab đã nhận văn bản cho phép riêng từ CEFR-J hoặc được các tổ chức nguồn bảo trợ.</p>
      </aside>

      <div className="grid gap-10">
        <SourceSection title="CEFR-J Wordlist v1.6">
          <p>1.018 mục A1–B2 được chọn lọc từ <cite>The CEFR-J Wordlist Version 1.6</cite>, biên soạn bởi Yukio Tono, Tono Laboratory, Tokyo University of Foreign Studies.</p>
          <p>ELVocab đã chọn mục từ, chuẩn hóa trường dữ liệu và bổ sung nghĩa tiếng Việt, phiên âm cùng ví dụ học tập. Việc sử dụng hiện tại giới hạn trong đồ án giáo dục phi thương mại; yêu cầu xin phép của CEFR-J vẫn được ghi nhận là chưa giải quyết.</p>
          <ExternalSourceLink href="https://cefr-j.org/download_eng.html">Trang nguồn CEFR-J</ExternalSourceLink>
        </SourceSection>

        <SourceSection title="Octanove Vocabulary Profile v1.0">
          <p>145 mục C1 được chọn lọc từ <cite>Octanove Vocabulary Profile C1/C2 Version 1.0</cite>, do Octanove Labs tạo và Open Language Profiles phân phối.</p>
          <p>Phần dữ liệu chuyển thể có nguồn gốc Octanove được phân phối theo CC BY-SA 4.0. ELVocab chỉ chọn mục C1, chuẩn hóa metadata và bổ sung nghĩa cùng ví dụ Anh–Việt. Phạm vi giấy phép này không áp dụng cho toàn bộ ứng dụng hoặc dữ liệu CEFR-J.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <ExternalSourceLink href="https://github.com/openlanguageprofiles/olp-en-cefrj">Nguồn Octanove</ExternalSourceLink>
            <ExternalSourceLink href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</ExternalSourceLink>
          </div>
          <a className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2.5 font-bold text-white no-underline hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-emerald-200" href="/data-sources/elvocab-octanove-derived-c1.csv" download>
            <Download className="size-4" aria-hidden="true" />Tải dữ liệu C1 chuyển thể (.csv)
          </a>
          <p className="mb-0 mt-3 text-sm text-slate-500">Tệp tải xuống gồm đúng 145 mục Octanove-derived và không chứa IPA, dữ liệu người dùng hoặc dữ liệu CEFR-J.</p>
        </SourceSection>

        <SourceSection title="Nguồn phát âm">
          <p>Nhiều phiên âm IPA được biên tập từ ARPABET của CMU Pronouncing Dictionary. Thông báo bản quyền và điều kiện phân phối của CMU được lưu cùng trang nguồn dữ liệu.</p>
          <p><cite>ipa-dict</cite> chỉ được dùng làm nguồn đối chiếu tự động trong quá trình QA; sự trùng khớp với nguồn này không được xem là xác minh từ điển độc lập.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <ExternalSourceLink href="https://github.com/cmusphinx/cmudict">CMU Pronouncing Dictionary</ExternalSourceLink>
            <a className={SOURCE_LINK_CLASSES} href="/data-sources/CMUDICT-LICENSE.txt">Thông báo giấy phép CMUdict</a>
            <ExternalSourceLink href="https://github.com/open-dict-data/ipa-dict">ipa-dict</ExternalSourceLink>
          </div>
        </SourceSection>

        <SourceSection title="Biên tập và giới hạn chất lượng">
          <p>ELVocab bổ sung nghĩa tiếng Việt, ví dụ Anh–Việt, lựa chọn từ loại, phiên âm IPA và cách tổ chức thành 15 bộ từ học tập. Các thay đổi này không ngụ ý nguồn ban đầu đã xác nhận hoặc bảo trợ nội dung ELVocab.</p>
          <p>Dataset chưa được con người kiểm duyệt ngôn ngữ đầy đủ và chưa được từ điển độc lập xác minh cho toàn bộ 1.163 mục. Hiện còn 211 trường hợp IPA cần thêm bằng chứng.</p>
        </SourceSection>
      </div>
    </article>
  );
}

function SourceSection({ children, title }) {
  return (
    <section className="grid gap-3 border-t border-slate-200 pt-7 first:border-t-0 first:pt-0">
      <h2 className="m-0 text-xl font-extrabold tracking-[-0.015em] text-slate-900 sm:text-2xl">{title}</h2>
      <div className="max-w-3xl text-[0.98rem] leading-7 text-slate-600 [&_p]:my-0 [&_p+_p]:mt-3">{children}</div>
    </section>
  );
}

function ExternalSourceLink({ children, href }) {
  return <a className={SOURCE_LINK_CLASSES} href={href} target="_blank" rel="noreferrer">{children}<ExternalLink className="size-3.5" aria-hidden="true" /></a>;
}
