export const SET_DETAIL_PAGE_SIZE = 10;

export function paginateSetDetailItems(items, page, pageSize = SET_DETAIL_PAGE_SIZE) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);

  return {
    currentPage,
    end: pageItems.length === 0 ? 0 : startIndex + pageItems.length,
    items: pageItems,
    start: pageItems.length === 0 ? 0 : startIndex + 1,
    totalItems,
    totalPages,
  };
}
