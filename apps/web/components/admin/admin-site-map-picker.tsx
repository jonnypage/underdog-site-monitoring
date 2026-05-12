'use client';

import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  GOOGLE_MAPS_LOADER_ID,
  getGoogleMapsBrowserKey,
} from '@/lib/google-maps-loader';
import { Spinner } from '@/components/ui/spinner';

/** Default view when coordinates are empty (e.g. new site). */
const DEFAULT_CENTER: google.maps.LatLngLiteral = {
  lat: 18.070931,
  lng: -88.555178,
};

const mapContainerStyle = {
  width: '100%',
  height: '480px',
  borderRadius: '0.375rem',
};

/** Shown once the Maps script is loaded (client only). */
function mapPickerOptions(): google.maps.MapOptions {
  return {
    mapTypeId: google.maps.MapTypeId.HYBRID,
    streetViewControl: false,
    mapTypeControl: true,
    mapTypeControlOptions: {
      mapTypeIds: [
        google.maps.MapTypeId.ROADMAP,
        google.maps.MapTypeId.SATELLITE,
        google.maps.MapTypeId.HYBRID,
      ],
    },
    fullscreenControl: false,
  };
}

function parseCoord(
  latStr: string,
  lngStr: string,
): google.maps.LatLngLiteral | null {
  const lat = Number(latStr.trim());
  const lng = Number(lngStr.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function formatCoord(n: number) {
  return String(Number(n.toFixed(6)));
}

type AdminSiteMapPickerProps = {
  latStr: string;
  lngStr: string;
  onLatLngChange: (lat: string, lng: string) => void;
};

export function AdminSiteMapPicker({
  latStr,
  lngStr,
  onLatLngChange,
}: AdminSiteMapPickerProps) {
  const apiKey = getGoogleMapsBrowserKey();
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
  });

  const position = useMemo(() => parseCoord(latStr, lngStr), [latStr, lngStr]);

  const center = position ?? DEFAULT_CENTER;
  const zoom = position ? 15 : 4;

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    if (position) {
      map.panTo(position);
      map.setZoom(15);
    }
  }, [isLoaded, position]);

  const setFromLatLng = useCallback(
    (latLng: google.maps.LatLng | null) => {
      if (!latLng) return;
      onLatLngChange(formatCoord(latLng.lat()), formatCoord(latLng.lng()));
    },
    [onLatLngChange],
  );

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      setFromLatLng(e.latLng);
    },
    [setFromLatLng],
  );

  const onMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      setFromLatLng(e.latLng);
    },
    [setFromLatLng],
  );

  if (!apiKey) {
    return (
      <div className='rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground'>
        Set{' '}
        <code className='rounded bg-muted px-1 py-0.5 text-xs'>
          NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY
        </code>{' '}
        in{' '}
        <code className='rounded bg-muted px-1 py-0.5 text-xs'>.env.local</code>{' '}
        and enable the{' '}
        <strong className='font-medium text-foreground'>
          Maps JavaScript API
        </strong>{' '}
        (and Embed API for dashboard iframes) on that key.
      </div>
    );
  }

  if (loadError) {
    return (
      <p className='text-sm text-red-600'>
        Could not load Google Maps. Check the API key and billing.
      </p>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className='flex items-center justify-center gap-2 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground'
        style={{ height: mapContainerStyle.height }}
        role='status'
      >
        <Spinner size='md' />
        <span>Loading map…</span>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={zoom}
        options={mapPickerOptions()}
        onLoad={onMapLoad}
        onClick={onMapClick}
        clickableIcons={false}
      >
        {position ? (
          <Marker position={position} draggable onDragEnd={onMarkerDragEnd} />
        ) : null}
      </GoogleMap>
      <p className='text-xs text-muted-foreground'>
        {position
          ? 'Drag the pin to adjust coordinates, or click elsewhere on the map to move it.'
          : 'Click the map to place a pin, then drag it to fine-tune. Coordinates stay in sync with the fields above.'}
      </p>
    </div>
  );
}
