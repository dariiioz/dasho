import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { faviconCacheExists, resolveFavicon } from "./favicon";

const iconSvg = "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' fill='#111827'/></svg>";
const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));
async function testDirectory() { const directory = await mkdtemp(join(tmpdir(), "dasho-favicon-")); directories.push(directory); return directory; }
function mockFetch(responses: Record<string, Response | Error>) { return async (input: URL | RequestInfo) => { const result = responses[input.toString()]; if (!result) return new Response("not found", { status: 404 }); if (result instanceof Error) throw result; return result.clone(); }; }
const defaults = { allowPrivateTargets: true, enableExternalService: false };

describe("resolveFavicon", () => {
  it("uses an Apple touch icon when a real-world style page exposes one", async () => {
    const page = "https://example.test/", icon = "https://example.test/assets/apple-touch-icon.png", dataDirectory = await testDirectory();
    const result = await resolveFavicon(page, "Apple-like", { ...defaults, iconsDirectory: join(dataDirectory, "icons"), fetch: mockFetch({ [page]: new Response("<link rel='apple-touch-icon' href='/assets/apple-touch-icon.png'>"), [icon]: new Response(iconSvg, { headers: { "content-type": "image/svg+xml" } }) }) as typeof fetch });
    expect(result.source).toBe("apple-touch-icon"); expect(await faviconCacheExists(result.cachePath, dataDirectory)).toBe(true);
  });
  it("falls back to the conventional favicon.ico endpoint", async () => {
    const page = "https://grafana.test/", icon = "https://grafana.test/favicon.ico";
    const result = await resolveFavicon(page, "Grafana", { ...defaults, iconsDirectory: await testDirectory(), fetch: mockFetch({ [page]: new Response("<html></html>"), [icon]: new Response(iconSvg, { headers: { "content-type": "image/svg+xml" } }) }) as typeof fetch });
    expect(result.source).toBe("favicon-ico");
  });
  it("keeps the original scheme and port for an internal favicon fallback", async () => {
    const page = "http://termix.test:8080/", icon = "http://termix.test:8080/favicon.ico";
    const result = await resolveFavicon(page, "Termix", { ...defaults, iconsDirectory: await testDirectory(), fetch: mockFetch({ [page]: new Response("<html></html>"), [icon]: new Response(iconSvg, { headers: { "content-type": "image/svg+xml" } }) }) as typeof fetch });
    expect(result).toMatchObject({ source: "favicon-ico", remoteUrl: icon });
  });
  it("uses the largest icon in a SPA manifest", async () => {
    const page = "https://spa.test/", manifest = "https://spa.test/manifest.webmanifest", icon = "https://spa.test/icons/icon-512.png";
    const result = await resolveFavicon(page, "SPA", { ...defaults, iconsDirectory: await testDirectory(), fetch: mockFetch({ [page]: new Response("<link rel='manifest' href='/manifest.webmanifest'>"), [manifest]: new Response(JSON.stringify({ icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }, { src: "/icons/icon-512.png", sizes: "512x512" }] })), [icon]: new Response(iconSvg, { headers: { "content-type": "image/svg+xml" } }) }) as typeof fetch });
    expect(result.source).toBe("manifest"); expect(result.remoteUrl).toBe(icon);
  });
  it("returns a monogram for a site with no icon source", async () => {
    const result = await resolveFavicon("https://empty.test/", "No icon", { ...defaults, iconsDirectory: await testDirectory(), fetch: mockFetch({ "https://empty.test/": new Response("<html></html>") }) as typeof fetch });
    expect(result).toMatchObject({ source: "monogram", monogram: "N", cachePath: null });
  });
  it("returns a monogram when the domain cannot be reached", async () => {
    const result = await resolveFavicon("https://offline.test/", "Offline", { ...defaults, iconsDirectory: await testDirectory(), fetch: mockFetch({ "https://offline.test/": new Error("Network unreachable") }) as typeof fetch });
    expect(result).toMatchObject({ source: "monogram", monogram: "O", cachePath: null });
  });
});
