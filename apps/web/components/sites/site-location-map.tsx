"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GOOGLE_MAPS_LOADER_ID, getGoogleMapsBrowserKey } from "@/lib/google-maps-loader";
import { Spinner } from "@/components/ui/spinner";

type SiteLocationMapProps = {
  latitude: number;
  longitude: number;
  title?: string;
};

export function SiteLocationMap({ latitude, longitude, title = "Location" }: SiteLocationMapProps) {
  const apiKey = getGoogleMapsBrowserKey();
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey ?? "",
  });

  const center = { lat: latitude, lng: longitude };
  const externalUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  const mapOptions: google.maps.MapOptions = {
    mapTypeId: "hybrid",
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!apiKey ? (
          <p className="text-sm text-muted-foreground italic p-4 border border-dashed rounded-md">
            Set <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY</code> to enable interactive maps.
          </p>
        ) : loadError ? (
          <p className="text-sm text-red-600">Error loading Google Maps.</p>
        ) : !isLoaded ? (
          <div
            role="status"
            className="flex h-[20.8rem] w-full flex-row items-center justify-center gap-2 rounded-md bg-muted text-sm text-muted-foreground"
          >
            <Spinner size="md" />
            <span>Loading map...</span>
          </div>
        ) : (
          <div className="h-[30.8rem] w-full overflow-hidden rounded-md border border-border">
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={center}
              zoom={15}
              options={mapOptions}
            >
              <Marker position={center} />
            </GoogleMap>
          </div>
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

