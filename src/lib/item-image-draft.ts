import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";

export type DraftItemImage =
  | {
      kind: "file";
      file: File;
      previewUrl: string;
    }
  | {
      kind: "remote";
      url: string;
      fallbackUrl?: string;
      previewUrl: string;
    };

type ImageMutationResponse = {
  imageUrl?: string | null;
};

export function buildItemImageSearchSeed(
  name?: unknown,
  brand?: unknown,
  model?: unknown,
  fallback?: unknown,
) {
  const productName = typeof name === "string" ? name.trim() : "";
  const brandText = typeof brand === "string" ? brand.trim() : "";
  const modelText = typeof model === "string" ? model.trim() : "";
  const fallbackText = typeof fallback === "string" ? fallback.trim() : "";
  const productLower = productName.toLowerCase();
  const metadata = [brandText, modelText].filter(
    (part) => part && !productLower.includes(part.toLowerCase()),
  );

  return (
    [productName, ...metadata].filter(Boolean).join(" ")
    || [brandText, modelText].filter(Boolean).join(" ")
    || fallbackText
  );
}

async function readImageMutationResponse(res: Response, fallbackMessage: string) {
  if (handleAuthRedirect(res)) {
    throw new Error("Your session expired before the image could be saved.");
  }
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, fallbackMessage));
  }
  const json = await parseJsonSafely<ImageMutationResponse>(res);
  if (!json?.imageUrl) {
    throw new Error("The image was saved, but the response could not be read.");
  }
  return json.imageUrl;
}

async function persistRemoteImage(endpoint: string, url: string) {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return readImageMutationResponse(res, "Could not save the selected image.");
}

export async function persistDraftItemImage(
  endpoint: string,
  image: DraftItemImage,
): Promise<string> {
  if (image.kind === "file") {
    const formData = new FormData();
    formData.append("file", image.file);
    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    return readImageMutationResponse(res, "Could not upload the selected image.");
  }

  try {
    return await persistRemoteImage(endpoint, image.url);
  } catch (error) {
    if (image.fallbackUrl && image.fallbackUrl !== image.url) {
      return persistRemoteImage(endpoint, image.fallbackUrl);
    }
    throw error;
  }
}
