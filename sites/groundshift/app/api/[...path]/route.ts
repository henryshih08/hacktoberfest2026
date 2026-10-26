import { findScenes, archiveInfo } from "../../../lib/groundshift/archive.mjs";
import { answerQuestion } from "../../../lib/groundshift/data.js";

const json = (status: number, data: unknown) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const safeError = (error: any) => error.name === "TimeoutError" ? "The imagery service took too long. Please try again." : error.message === "fetch failed" ? "Cannot reach the satellite catalogue. Please try again." : error instanceof SyntaxError ? "Invalid request JSON." : error.message || "Request failed.";
async function readBody(request: Request) {
  if (!request.body) throw new Error("Request body required.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder(); let text = "", bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 10000) { await reader.cancel(); throw new Error("Request too large"); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/scenes") return json(200, await findScenes(url.searchParams.get("bbox"), url.searchParams.get("date")));
    if (request.method === "GET" && url.pathname === "/api/archive") return json(200, await archiveInfo(url.searchParams.get("bbox")));
    if (request.method === "GET" && url.pathname === "/api/image") {
      const upstreamUrl = new URL(url.searchParams.get("url") || "");
      const allowed = upstreamUrl.protocol === "https:" && !upstreamUrl.username && !upstreamUrl.password && !upstreamUrl.port && (
        upstreamUrl.hostname === "planetarycomputer.microsoft.com" && upstreamUrl.pathname.startsWith("/api/data/v1/item/bbox/") ||
        upstreamUrl.hostname === "gis.wildlife.ca.gov" && /^\/images\/rest\/services\/Base_Remote_Sensing\/NAIP_\d{4}\/ImageServer\/exportImage$/.test(upstreamUrl.pathname) ||
        upstreamUrl.hostname === "apps.geo.fpac.usda.gov" && upstreamUrl.pathname === "/geo-imagery/rest/services/naip/conus_naip/ImageServer/exportImage" ||
        upstreamUrl.hostname === "imagery.nationalmap.gov" && upstreamUrl.pathname === "/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage");
      if (!allowed) return json(400, { error: "Unsupported imagery source" });
      const image = await fetch(upstreamUrl, { redirect: "manual", signal: AbortSignal.timeout(60000) });
      if (!image.ok) return json(502, { error: "Image service could not render this acquisition." });
      const contentType = image.headers.get("content-type") || "";
      if (!contentType.startsWith("image/") || Number(image.headers.get("content-length")) > 25000000 || !image.body) return json(502, { error: "Invalid image response" });
      let bytes = 0;
      const limited = image.body.pipeThrough(new TransformStream({ transform(chunk, controller) { bytes += chunk.byteLength; if (bytes > 25000000) { controller.error(new Error("Image response too large")); return; } controller.enqueue(chunk); } }));
      return new Response(limited, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
    }
    if (request.method === "POST" && url.pathname === "/api/ask") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) return json(403, { error: "Origin not allowed" });
      const data = await readBody(request);
      if (typeof data.question !== "string" || !data.question.trim() || data.question.length > 1000) return json(400, { error: "Enter a question of up to 1,000 characters." });
      if (data.context) return json(404, { error: "Comparison chat has been removed." });
      return json(200, answerQuestion(data.question, data.selectedId));
    }
    return json(404, { error: "Unknown endpoint" });
  } catch (error) { return json(400, { error: safeError(error) }); }
}
export const GET = handle;
export const POST = handle;
