import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminBadge, AdminDialog, AdminState } from "./admin-ui-primitives.jsx";
import { loadAdminVocabularyList } from "../dashboard/admin-vocabulary-store.js";

const LIMIT = 100;

export function AdminSystemSetPicker({ onCancel, onConfirm, onNavigateToVocabulary, open, returnFocusRef, selected }) {
  const [source, setSource] = useState([]);
  const [draft, setDraft] = useState(() => selected);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("loading");
  const searchRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadAdminVocabularyList().then(
      (items) => { if (active) { setSource(items); setStatus("ready"); } },
      () => { if (active) setStatus("error"); },
    );
    return () => { active = false; };
  }, []);

  const selectedIds = useMemo(() => new Set(draft.map((item) => item.vocabulary_id)), [draft]);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return source.filter((item) => !needle || [item.word, item.phonetic, item.primary_meaning?.meaning_vi, item.meanings?.[0]?.meaning_vi].some((value) => value?.toLocaleLowerCase("vi").includes(needle))).slice(0, LIMIT);
  }, [query, source]);

  function toggle(item) {
    if (selectedIds.has(item.id)) setDraft((current) => current.filter((entry) => entry.vocabulary_id !== item.id));
    else setDraft((current) => [...current, toSelectedItem(item)]);
  }

  return <AdminDialog className="admin-system-set-picker" open={open} title="Chọn từ từ Kho từ vựng" description="Chọn nhiều từ cùng lúc. Thứ tự chọn sẽ là thứ tự ban đầu trong bộ từ." initialFocusRef={searchRef} returnFocusRef={returnFocusRef} onRequestClose={onCancel} footer={<><button type="button" onClick={onCancel}>Hủy</button><button type="button" className="admin-primary-action" onClick={() => onConfirm(draft)}>Xác nhận ({draft.length})</button></>}>
    <label className="admin-search-field"><Search aria-hidden="true" /><span className="sr-only">Tìm trong Kho từ vựng</span><input ref={searchRef} name="vocabulary_query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo từ, phiên âm hoặc nghĩa…" autoComplete="off" /></label>
    {status === "loading" ? <AdminState kind="loading" title="Đang tải Kho từ vựng" message="Vui lòng chờ…" /> : null}
    {status === "error" ? <AdminState kind="error" title="Không thể tải Kho từ vựng" message="Hãy thử tải lại danh sách." action={<button type="button" onClick={() => { setStatus("loading"); loadAdminVocabularyList({ force: true }).then((items) => { setSource(items); setStatus("ready"); }, () => setStatus("error")); }}>Thử lại</button>} /> : null}
    {status === "ready" && source.length === 0 ? <AdminState title="Kho từ vựng chưa có từ nào" message="Hãy thêm từ vựng trước khi tạo bộ từ." action={<button type="button" onClick={onNavigateToVocabulary}>Đi đến Kho từ vựng</button>} /> : null}
    {status === "ready" && source.length > 0 && matches.length === 0 ? <AdminState title="Không tìm thấy từ phù hợp" message="Hãy thử từ khóa khác." /> : null}
    {status === "ready" && matches.length > 0 ? <ul className="admin-system-set-picker-list" aria-label="Từ vựng có thể chọn">{matches.map((item) => { const checked = selectedIds.has(item.id); const meaning = item.primary_meaning ?? item.meanings?.[0]; return <li key={item.id}><label><input type="checkbox" checked={checked} onChange={() => toggle(item)} /><span><strong>{item.word}</strong><small>{[item.phonetic, meaning?.meaning_vi].filter(Boolean).join(" · ") || "Chưa có thông tin bổ sung"}</small></span>{checked ? <AdminBadge tone="sky">Đã chọn</AdminBadge> : null}</label></li>; })}</ul> : null}
    {status === "ready" && source.length > LIMIT && !query ? <p className="admin-system-set-picker-note">Đang hiển thị {LIMIT} từ đầu tiên. Dùng ô tìm kiếm để tìm từ khác.</p> : null}
  </AdminDialog>;
}

function toSelectedItem(item) {
  return { vocabulary_id: item.id, word: item.word, phonetic: item.phonetic ?? null, source: item.source, primary_meaning: item.primary_meaning ?? item.meanings?.[0] ?? null };
}
