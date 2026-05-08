const FORMULA_PREFIX_RE = /^\s*[=+\-@]/;

export function csvField(value: string | number | boolean | Date | null | undefined): string {
  if (value == null) return "";

  let s = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_PREFIX_RE.test(s)) {
    s = `'${s}`;
  }

  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }

  return s;
}
