export type VisualMediaKind = "image" | "video";

export interface VisualAsset {
  id: string;
  kind: VisualMediaKind;
  title: string;
  mediaUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  license: string;
  attribution: string;
  startSeconds: number;
  endSeconds: number;
}

export interface CommonsSearchResult extends Omit<VisualAsset, "id" | "startSeconds" | "endSeconds"> {
  id: string;
}

interface CommonsMetadataValue {
  value?: string;
}

interface CommonsImageInfo {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: Record<string, CommonsMetadataValue>;
}

interface CommonsPage {
  pageid: number;
  title: string;
  imageinfo?: CommonsImageInfo[];
}

interface CommonsResponse {
  query?: { pages?: Record<string, CommonsPage> };
  error?: { info?: string };
}

function cleanMetadata(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\\s+/g, " ").trim();
}

export function parseCommonsResults(payload: unknown): CommonsSearchResult[] {
  if (!payload || typeof payload !== "object") return [];
  const response = payload as CommonsResponse;
  const pages = Object.values(response.query?.pages ?? {});
  return pages.flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!info?.url || !info.descriptionurl) return [];
    const mime = info.mime ?? "";
    const kind: VisualMediaKind = mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : "image";
    const metadata = info.extmetadata ?? {};
    const license = cleanMetadata(metadata.LicenseShortName?.value) || "License not stated";
    const artist = cleanMetadata(metadata.Artist?.value);
    const credit = cleanMetadata(metadata.Credit?.value);
    return [{
      id: String(page.pageid),
      kind,
      title: page.title.replace(/^File:/, ""),
      mediaUrl: info.url,
      thumbnailUrl: info.thumburl ?? info.url,
      sourceUrl: info.descriptionurl,
      license,
      attribution: [artist, credit].filter(Boolean).join(" · ") || "Author not stated",
    }];
  });
}

/** Search freely reusable community media on Wikimedia Commons; always preserve source and license metadata. */
export async function searchCommonsMedia(query: string, kind: VisualMediaKind = "image", signal?: AbortSignal): Promise<CommonsSearchResult[]> {
  const term = query.trim();
  if (term.length < 2) throw new Error("Enter at least two characters to search for media");
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: term + (kind === "video" ? " filetype:video" : " filetype:bitmap"),
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "640",
    iiextmetadatafilter: "LicenseShortName|Artist|Credit",
    format: "json",
    origin: "*",
  });
  const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString(), { signal });
  if (!response.ok) throw new Error("Wikimedia Commons search is temporarily unavailable");
  const payload = await response.json() as CommonsResponse;
  if (payload.error?.info) throw new Error(payload.error.info);
  return parseCommonsResults(payload).filter((item) => item.kind === kind);
}
