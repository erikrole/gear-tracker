import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

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

/** Like ok(), but adds a private 60s browser cache with 5-min stale-while-revalidate. */
export function cachedOk<T>(data: T) {
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, ...(error.data ? { data: error.data } : {}) },
      { status: error.status }
    );
  }

  // Zod validation errors — return 400 with field-level details
  if (error instanceof ZodError) {
    const messages = error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`
    );
    return NextResponse.json(
      { error: "Validation failed", details: messages },
      { status: 400 }
    );
  }

  // Serialization conflict (SERIALIZABLE isolation) — retryable by client
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return NextResponse.json(
      { error: "Someone else submitted at the same time — please try again." },
      { status: 409 }
    );
  }

  console.error(error);
  Sentry.captureException(error);
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
