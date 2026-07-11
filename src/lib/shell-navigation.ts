export function routeMatches(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function resolveActiveShellHref(pathname: string, hrefs: string[]) {
  return hrefs
    .filter((href) => routeMatches(pathname, href))
    .sort((a, b) => b.length - a.length)[0] ?? null;
}
