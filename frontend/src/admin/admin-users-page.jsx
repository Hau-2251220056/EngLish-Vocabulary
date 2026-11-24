import { CalendarDays, Eye, Flame, Search, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { adminUserService } from "../services/admin-user-service.js";
import { AdminBadge, AdminDialog, AdminPagination, AdminState, AdminToolbar } from "./admin-ui-primitives.jsx";
import "./admin-management.css";
import "./admin-users.css";

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;

export function AdminUsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ status: "loading", items: [], pagination: null, error: null });
  const [detail, setDetail] = useState(null);
  const detailTriggerRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = searchInput.trim();
      if (nextQuery !== query) {
        setResult((current) => ({ ...current, status: "loading", error: null }));
        setPage(1);
        setQuery(nextQuery);
      }
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    adminUserService.listUsers({ page, pageSize: PAGE_SIZE, query, role, signal: controller.signal }).then(
      (data) => {
        const lastPage = Math.max(1, data.pagination.total_pages);
        if (data.pagination.total_items > 0 && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setResult({ status: "success", items: data.items, pagination: data.pagination, error: null });
      },
      (error) => { if (!controller.signal.aborted) setResult((current) => ({ ...current, status: "error", error })); },
    );
    return () => controller.abort();
  }, [page, query, reloadToken, role]);

  function changeRole(event) {
    setResult((current) => ({ ...current, status: "loading", error: null }));
    setRole(event.target.value);
    setPage(1);
  }

  function retryList() {
    setResult((current) => ({ ...current, status: "loading", error: null }));
    setReloadToken((value) => value + 1);
  }

  function openDetail(user, trigger) {
    detailTriggerRef.current = trigger;
    setDetail({ id: user.id, name: user.display_name, status: "loading", user: null, error: null, retry: 0 });
  }

  const pagination = result.pagination;
  const total = pagination?.total_items ?? 0;

  return <section className="admin-management-page admin-users-page" aria-labelledby="admin-users-title">
    <header className="admin-management-header"><div><div className="admin-management-title"><h1 id="admin-users-title">Quản lý người dùng</h1>{result.status === "success" ? <AdminBadge label={`Tổng cộng ${total} tài khoản`}>{total}</AdminBadge> : null}</div><p>Xem thông tin tài khoản hệ thống. Mọi dữ liệu trên trang này chỉ đọc.</p></div><span className="admin-users-readonly"><ShieldCheck aria-hidden="true" />Chế độ chỉ đọc</span></header>

    <AdminToolbar className="admin-management-toolbar admin-users-toolbar">
      <label className="admin-search-control"><span>Tìm kiếm người dùng</span><span className="admin-search-input"><Search aria-hidden="true" /><input type="search" name="admin-user-search" autoComplete="off" placeholder="Tìm theo tên hiển thị hoặc email…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></span></label>
      <label className="admin-filter-control"><span>Vai trò</span><select name="admin-user-role" value={role} onChange={changeRole}><option value="">Tất cả vai trò</option><option value="USER">Người học (USER)</option><option value="ADMIN">Quản trị viên (ADMIN)</option></select></label>
    </AdminToolbar>

    {result.status === "loading" ? <AdminState kind="loading" title="Đang tải người dùng" message="Danh sách tài khoản đang được cập nhật…" /> : null}
    {result.status === "error" ? <AdminState kind="error" title="Không thể tải người dùng" message={listErrorMessage(result.error)} action={<button className="admin-secondary-button" type="button" onClick={retryList}>Thử lại</button>} /> : null}
    {result.status === "success" && result.items.length === 0 ? <AdminState title={query || role ? "Không tìm thấy tài khoản" : "Chưa có tài khoản"} message={query || role ? "Thử từ khóa khác hoặc thay đổi bộ lọc vai trò." : "Hệ thống chưa có tài khoản để hiển thị."} /> : null}

    {result.status === "success" && result.items.length > 0 ? <div className="admin-table-card admin-users-table-card"><div className="admin-table-scroll"><table className="admin-management-table admin-users-table"><caption className="sr-only">Danh sách tài khoản người dùng</caption><thead><tr><th scope="col">Người dùng</th><th scope="col">Email</th><th scope="col">Vai trò</th><th scope="col">Chuỗi học</th><th scope="col">Ngày tạo</th><th scope="col"><span className="sr-only">Chi tiết</span></th></tr></thead><tbody>{result.items.map((user) => <tr key={user.id}><th scope="row"><span className={`admin-user-identity is-${user.role.toLowerCase()}`}><span className="admin-user-avatar" aria-hidden="true">{initials(user.display_name)}</span><span title={user.display_name}>{user.display_name}</span></span></th><td data-label="Email"><span className="admin-user-email" title={user.email}>{user.email}</span></td><td data-label="Vai trò"><RoleBadge role={user.role} /></td><td data-label="Chuỗi học"><CurrentStreak user={user} /></td><td data-label="Ngày tạo">{formatDate(user.created_at)}</td><td><div className="admin-action-group"><button className="admin-secondary-button admin-user-view" type="button" aria-label={`Xem chi tiết ${user.display_name}`} onClick={(event) => openDetail(user, event.currentTarget)}><Eye aria-hidden="true" />Xem</button></div></td></tr>)}</tbody></table></div><AdminPagination currentPage={pagination.page} totalPages={pagination.total_pages} pageSize={pagination.page_size} totalItems={pagination.total_items} onPrevious={() => { setResult((current) => ({ ...current, status: "loading", error: null })); setPage((value) => Math.max(1, value - 1)); }} onNext={() => { setResult((current) => ({ ...current, status: "loading", error: null })); setPage((value) => Math.min(pagination.total_pages, value + 1)); }} /></div> : null}

    {detail ? <UserDetailDialog detail={detail} setDetail={setDetail} returnFocusRef={detailTriggerRef} /> : null}
  </section>;
}

function UserDetailDialog({ detail, returnFocusRef, setDetail }) {
  useEffect(() => {
    const controller = new AbortController();
    adminUserService.getUser(detail.id, { signal: controller.signal }).then(
      (user) => setDetail((current) => current?.id === detail.id ? { ...current, status: "success", user, error: null } : current),
      (error) => { if (!controller.signal.aborted) setDetail((current) => current?.id === detail.id ? { ...current, status: "error", error } : current); },
    );
    return () => controller.abort();
  }, [detail.id, detail.retry, setDetail]);

  const close = () => setDetail(null);
  return <AdminDialog open className="is-management-detail admin-user-detail-dialog" title="Thông tin tài khoản người dùng" description={`Mã tài khoản: ${detail.id}`} returnFocusRef={returnFocusRef} onRequestClose={close} footer={<button type="button" onClick={close}>Đóng</button>}>
    {detail.status === "loading" ? <AdminState kind="loading" title="Đang tải chi tiết" message="Thông tin tài khoản đang được cập nhật…" /> : null}
    {detail.status === "error" ? <AdminState kind="error" title="Không thể tải chi tiết" message={detailErrorMessage(detail.error)} action={<button className="admin-secondary-button" type="button" onClick={() => setDetail((current) => ({ ...current, status: "loading", retry: current.retry + 1 }))}>Thử lại</button>} /> : null}
    {detail.status === "success" && detail.user ? <div className="admin-user-detail"><div className={`admin-user-detail-hero is-${detail.user.role.toLowerCase()}`}><span className="admin-user-detail-avatar" aria-hidden="true">{initials(detail.user.display_name)}</span><div><h3>{detail.user.display_name}</h3><p>{detail.user.email}</p></div></div><dl><div><dt>Vai trò hệ thống</dt><dd><RoleBadge role={detail.user.role} /></dd></div><div><dt>Ngày khởi tạo</dt><dd><CalendarDays aria-hidden="true" />{formatDate(detail.user.created_at)}</dd></div><div><dt>Trạng thái</dt><dd>{detail.user.is_active ? "Đang hoạt động" : "Không hoạt động"}</dd></div><div><dt>Cập nhật gần nhất</dt><dd>{formatDate(detail.user.updated_at)}</dd></div></dl></div> : null}
  </AdminDialog>;
}

function RoleBadge({ role }) {
  return role === "ADMIN" ? <AdminBadge tone="sky"><ShieldCheck aria-hidden="true" />ADMIN</AdminBadge> : <AdminBadge tone="slate"><UserRound aria-hidden="true" />USER</AdminBadge>;
}

function CurrentStreak({ user }) {
  if (user.role === "ADMIN") return <span className="admin-user-streak is-na" aria-label="Chuỗi học không áp dụng cho quản trị viên">—</span>;
  if (!Number.isInteger(user.current_streak) || user.current_streak < 0) return <span className="admin-user-streak is-unavailable" title="Dữ liệu chuỗi học không khả dụng">Không khả dụng</span>;
  const positive = user.current_streak > 0;
  return <span className={`admin-user-streak ${positive ? "is-positive" : "is-zero"}`} aria-label={`Chuỗi học hiện tại ${user.current_streak} ngày`} title={`Chuỗi học hiện tại: ${user.current_streak} ngày`}><Flame aria-hidden="true" />{user.current_streak}</span>;
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "?").toLocaleUpperCase("vi");
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không xác định" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

function listErrorMessage(error) {
  return error?.code === "FORBIDDEN" ? "Tài khoản hiện tại không có quyền xem danh sách này." : "Kiểm tra kết nối rồi thử lại.";
}

function detailErrorMessage(error) {
  return error?.code === "USER_NOT_FOUND" ? "Tài khoản này không còn tồn tại." : "Không thể tải thông tin tài khoản. Hãy thử lại.";
}
