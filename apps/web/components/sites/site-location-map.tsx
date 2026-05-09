"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SiteLocationMapProps = {
  latitude: number;
  longitude: number;
  title?: string;
};

export function SiteLocationMap({ latitude, longitude, title = "Location" }: SiteLocationMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
  // Embed API allows only `roadmap` or `satellite` (not `hybrid` like the JS Maps API).
  const embedUrl =
    apiKey && apiKey.length > 0
      ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${latitude},${longitude}&zoom=15&maptype=satellite`
      : null;
  const externalUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {embedUrl ? (
          <iframe
            title="Site map"
            className="h-[20.8rem] w-full rounded-md border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            src={embedUrl}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Add <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY</code> to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> for an embedded map (Google Maps Embed API).
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}{" "}
          <a className="text-primary underline" href={externalUrl} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
