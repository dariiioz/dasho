import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { Agent, fetch as undiciFetch } from "undici";

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const FAVICON_USER_AGENT = "Dasho favicon resolver/1.0";
const selfSignedDispatcher = new Agent({ connect: { rejectUnauthorized: false } });

export type FaviconSource = "apple-touch-icon" | "icon" | "shortcut-icon" | "og-image" | "favicon-ico" | "manifest" | "external-service" | "monogram";
export type FaviconResolution = { source: FaviconSource; cachePath: string | null; remoteUrl: string | null; monogram: string | null };
type Lookup = (hostname: string) => Promise<string[]>;
export type FaviconResolverOptions = { fetch?: typeof globalThis.fetch; lookup?: Lookup; iconsDirectory?: string; allowPrivateTargets?: boolean; enableExternalService?: boolean };
type Candidate = { source: Exclude<FaviconSource, "monogram">; url: URL };

function environmentFlag(name: string, fallback: boolean) {
  const value = process.env[name];
  return value === undefined ? fallback : value.toLowerCase() === "true";
}
function defaultLookup(hostname: string) {
  return dnsLookup(hostname, { all: true, verbatim: true }).then((records) => records.map((record) => record.address));
}
function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 || (first === 100 && second >= 64 && second <= 127) || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 198 && (second === 18 || second === 19)) || first >= 224;
}
async function assertSafeTarget(url: URL, lookup: Lookup, allowPrivateTargets: boolean) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only HTTP(S) icon URLs are allowed.");
  if (allowPrivateTargets) return;
  const addresses = await lookup(url.hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error("The target resolves to a private or unsafe IP address.");
}
async function readResponse(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error("Icon exceeds the 2 MB limit.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error("Icon exceeds the 2 MB limit.");
  return buffer;
}
async function fetchFollowingRedirects(url: URL, options: Required<Pick<FaviconResolverOptions, "fetch" | "lookup" | "allowPrivateTargets">>) {
  let target = url;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeTarget(target, options.lookup, options.allowPrivateTargets);
    const allowSelfSigned = environmentFlag("ALLOW_SELF_SIGNED_CERTIFICATES", false);
    const response = await options.fetch(target, { redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { "User-Agent": FAVICON_USER_AGENT }, ...(allowSelfSigned ? { dispatcher: selfSignedDispatcher } : {}) } as RequestInit);
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url: target };
    const location = response.headers.get("location");
    if (!location || redirectCount === MAX_REDIRECTS) throw new Error("Too many favicon redirects.");
    target = new URL(location, target);
  }
  throw new Error("Too many favicon redirects.");
}
function relIncludes(rel: string | undefined, token: string) { return rel?.toLowerCase().split(/\s+/).includes(token) ?? false; }
function largestIconHref($: cheerio.CheerioAPI) {
  const candidates = $("link").filter((_, element) => relIncludes($(element).attr("rel"), "icon") && !relIncludes($(element).attr("rel"), "shortcut")).map((_, element) => {
    const href = $(element).attr("href"); const sizes = $(element).attr("sizes")?.toLowerCase() ?? "";
    const size = sizes === "any" ? Number.MAX_SAFE_INTEGER : Math.max(...[...sizes.matchAll(/(\d+)x(\d+)/g)].map((match) => Number(match[1]) * Number(match[2])), 0);
    return href ? { href, size } : null;
  }).get().filter((candidate): candidate is { href: string; size: number } => candidate !== null).sort((a, b) => b.size - a.size);
  return candidates[0]?.href;
}
function parseHtmlCandidates(html: string, pageUrl: URL) {
  const $ = cheerio.load(html);
  const candidate = (source: Candidate["source"], href: string | undefined): Candidate | null => { try { return href ? { source, url: new URL(href, pageUrl) } : null; } catch { return null; } };
  const apple = $("link").filter((_, element) => relIncludes($(element).attr("rel"), "apple-touch-icon")).first().attr("href");
  const shortcut = $("link").filter((_, element) => relIncludes($(element).attr("rel"), "shortcut") && relIncludes($(element).attr("rel"), "icon")).first().attr("href");
  return {
    candidates: [candidate("apple-touch-icon", apple), candidate("icon", largestIconHref($)), candidate("shortcut-icon", shortcut), candidate("og-image", $("meta[property='og:image']").first().attr("content"))].filter((item): item is Candidate => item !== null),
    manifest: candidate("manifest", $("link").filter((_, element) => relIncludes($(element).attr("rel"), "manifest")).first().attr("href")),
  };
}
async function manifestCandidate(manifest: Candidate, fetchOptions: Parameters<typeof fetchFollowingRedirects>[1]) {
  const { response, url } = await fetchFollowingRedirects(manifest.url, fetchOptions);
  if (!response.ok) throw new Error("Manifest request failed.");
  const data = JSON.parse((await readResponse(response, MAX_FILE_SIZE)).toString()) as { icons?: Array<{ src?: string; sizes?: string }> };
  const icon = [...(data.icons ?? [])].sort((a, b) => (b.sizes === "any" ? Number.MAX_SAFE_INTEGER : Number.parseInt(b.sizes ?? "0", 10)) - (a.sizes === "any" ? Number.MAX_SAFE_INTEGER : Number.parseInt(a.sizes ?? "0", 10))).find((item) => item.src)?.src;
  if (!icon) throw new Error("Manifest does not contain an icon.");
  return { source: "manifest" as const, url: new URL(icon, url) };
}
function extensionFor(contentType: string | null, body: Buffer) { if (contentType?.includes("svg") || body.subarray(0, 512).toString().includes("<svg")) return "svg"; if (contentType?.includes("icon") || body.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return "ico"; return "webp"; }
async function saveIcon(candidate: Candidate, fetchOptions: Parameters<typeof fetchFollowingRedirects>[1], iconsDirectory: string) {
  const { response, url } = await fetchFollowingRedirects(candidate.url, fetchOptions);
  if (!response.ok) throw new Error(`Icon request failed with ${response.status}.`);
  const body = await readResponse(response, MAX_FILE_SIZE); const extension = extensionFor(response.headers.get("content-type"), body);
  const filename = `${createHash("sha256").update(url.toString()).digest("hex")}.${extension}`;
  await mkdir(iconsDirectory, { recursive: true });
  await writeFile(join(iconsDirectory, filename), extension === "svg" || extension === "ico" ? body : await sharp(body).resize(128, 128, { fit: "inside", withoutEnlargement: false }).webp().toBuffer());
  return `icons/${filename}`;
}
function monogramFor(name: string | undefined, url: URL) { return (name?.trim().charAt(0) || url.hostname.charAt(0) || "?").toUpperCase(); }

/** Resolves an icon server-side and never returns a remote image URL for rendering. */
export async function resolveFavicon(serviceUrl: string, name?: string, overrides: FaviconResolverOptions = {}): Promise<FaviconResolution> {
  const pageUrl = new URL(serviceUrl);
  const fetchOptions = { fetch: overrides.fetch ?? (undiciFetch as unknown as typeof globalThis.fetch), lookup: overrides.lookup ?? defaultLookup, allowPrivateTargets: overrides.allowPrivateTargets ?? environmentFlag("ALLOW_PRIVATE_TARGETS", true) };
  const iconsDirectory = overrides.iconsDirectory ?? join(process.env.DATA_DIR ?? join(process.cwd(), "data"), "icons");
  const candidates: Candidate[] = []; let manifest: Candidate | null = null;
  try { const { response } = await fetchFollowingRedirects(pageUrl, fetchOptions); if (response.ok) { const parsed = parseHtmlCandidates((await readResponse(response, MAX_FILE_SIZE)).toString(), pageUrl); candidates.push(...parsed.candidates); manifest = parsed.manifest; } } catch { /* Try remaining fallbacks. */ }
  candidates.push({ source: "favicon-ico", url: new URL("/favicon.ico", pageUrl.origin) });
  if (manifest) try { candidates.push(await manifestCandidate(manifest, fetchOptions)); } catch { /* Continue. */ }
  if (overrides.enableExternalService ?? environmentFlag("ENABLE_EXTERNAL_FAVICON_SERVICE", true)) candidates.push({ source: "external-service", url: new URL(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(pageUrl.hostname)}&sz=128`) });
  for (const item of candidates) try { return { source: item.source, cachePath: await saveIcon(item, fetchOptions, iconsDirectory), remoteUrl: item.url.toString(), monogram: null }; } catch { /* next fallback */ }
  return { source: "monogram", cachePath: null, remoteUrl: null, monogram: monogramFor(name, pageUrl) };
}

export async function cacheRemoteIcon(iconUrl: string, overrides: FaviconResolverOptions = {}) {
  const url = new URL(iconUrl);
  const fetchOptions = {
    fetch: overrides.fetch ?? (undiciFetch as unknown as typeof globalThis.fetch),
    lookup: overrides.lookup ?? defaultLookup,
    allowPrivateTargets:
      overrides.allowPrivateTargets ?? environmentFlag("ALLOW_PRIVATE_TARGETS", true),
  };
  const iconsDirectory =
    overrides.iconsDirectory ?? join(process.env.DATA_DIR ?? join(process.cwd(), "data"), "icons");
  return saveIcon({ source: "icon", url }, fetchOptions, iconsDirectory);
}
export async function faviconCacheExists(cachePath: string | null | undefined, dataDirectory = process.env.DATA_DIR ?? join(process.cwd(), "data")) {
  if (!cachePath || cachePath.includes("..") || !cachePath.startsWith("icons/")) return false;
  try { await access(join(dataDirectory, cachePath)); return true; } catch { return false; }
}
