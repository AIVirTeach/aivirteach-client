const guacamoleBaseUrl = "https://aivirteach.invalid";
const defaultGuacamolePublicPath = "/guacamole/";
const maxEmbedUrlLength = 64 * 1024;
const invalidEmbedUrlMessage = "The Learning VM returned an invalid browser connection URL.";

export function normalizeGuacamolePublicPath(value = defaultGuacamolePublicPath): string {
  const configured = value.trim();
  if (
    configured === "/"
    || !configured.startsWith("/")
    || configured.startsWith("//")
    || configured.includes("?")
    || configured.includes("#")
  ) {
    throw new Error("The Guacamole public path configuration is invalid.");
  }

  const withTrailingSlash = configured.endsWith("/") ? configured : `${configured}/`;
  const parsed = new URL(withTrailingSlash, guacamoleBaseUrl);
  if (parsed.origin !== guacamoleBaseUrl || parsed.pathname !== withTrailingSlash) {
    throw new Error("The Guacamole public path configuration is invalid.");
  }
  return withTrailingSlash;
}

/**
 * Keep opaque Guacamole tickets on the frontend's same-origin proxy.
 * Never accept a server-provided absolute URL or a second query parameter.
 */
export function validateLabEmbedUrl(
  value: string,
  guacamolePublicPath = defaultGuacamolePublicPath,
): string {
  const trustedPath = normalizeGuacamolePublicPath(guacamolePublicPath);
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maxEmbedUrlLength
    || value !== value.trim()
    || !value.startsWith(trustedPath)
  ) {
    throw new Error(invalidEmbedUrlMessage);
  }

  let parsed: URL;
  try {
    parsed = new URL(value, guacamoleBaseUrl);
  } catch {
    throw new Error(invalidEmbedUrlMessage);
  }

  const queryEntries = [...parsed.searchParams.entries()];
  const hasOneOpaqueTicket = queryEntries.length === 1
    && queryEntries[0][0] === "data"
    && queryEntries[0][1].length > 0;

  if (
    parsed.origin !== guacamoleBaseUrl
    || parsed.pathname !== trustedPath
    || parsed.hash !== ""
    || !hasOneOpaqueTicket
  ) {
    throw new Error(invalidEmbedUrlMessage);
  }

  return value;
}
