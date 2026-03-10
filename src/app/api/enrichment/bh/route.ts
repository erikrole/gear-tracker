export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { HttpError, fail, ok } from "@/lib/http";
import { isValidBHUrl, parseBHProduct } from "@/lib/services/bh-parser";

export async function POST(req: Request) {
  try {
    await requireAuth();

    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      throw new HttpError(400, "URL is required");
    }

    if (!isValidBHUrl(url)) {
      throw new HttpError(400, "URL must be a bhphotovideo.com product page");
    }

    const data = await parseBHProduct(url);
    return ok({ data });
  } catch (error) {
    return fail(error);
  }
}
