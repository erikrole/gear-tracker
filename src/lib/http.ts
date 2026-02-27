import { NextResponse } from "next/server";

export class HttpError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, message: string, data: unknown = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, ...(error.data ? { data: error.data } : {}) },
      { status: error.status }
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

const PAGINATION_DEFAULT_LIMIT = 50;
const PAGINATION_MAX_LIMIT = 200;

export type PaginationParams = {
  limit: number;
  offset: number;
};

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const rawOffset = parseInt(searchParams.get("offset") ?? "", 10);

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, PAGINATION_MAX_LIMIT)
      : PAGINATION_DEFAULT_LIMIT;

  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  return { limit, offset };
}
