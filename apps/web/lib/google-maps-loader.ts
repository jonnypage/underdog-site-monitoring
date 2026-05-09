/** Single script id for `useJsApiLoader` so Maps loads once per session. */
export const GOOGLE_MAPS_LOADER_ID = "underdog-google-maps-js";

export function getGoogleMapsBrowserKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY?.trim() ?? "";
}
