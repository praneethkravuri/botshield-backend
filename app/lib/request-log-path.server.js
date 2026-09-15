export function requestLogPathname(req) {
  if (req?.path) return req.path;
  return String(req?.url || "").split("?")[0] || "/";
}
