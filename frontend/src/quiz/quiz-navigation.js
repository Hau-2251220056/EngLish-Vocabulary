export function resolveQuizSetDetailPath(setId, state) {
  const publicDetail = `/vocabulary-sets/${setId}`;
  const privateDetail = `/my/vocabulary-sets/${setId}`;
  return [publicDetail, privateDetail].includes(state?.returnTo)
    ? state.returnTo
    : publicDetail;
}
