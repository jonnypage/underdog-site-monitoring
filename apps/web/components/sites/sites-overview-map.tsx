'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  GoogleMap,
  Marker,
  OVERLAY_MOUSE_TARGET,
  OverlayView,
  useJsApiLoader,
} from '@react-google-maps/api';
import { useRouter } from 'next/navigation';
import { siteStatusSurfaceClassName } from '@/components/site-status-badge';
import { cn } from '@/lib/utils';
import {
  GOOGLE_MAPS_LOADER_ID,
  getGoogleMapsBrowserKey,
} from '@/lib/google-maps-loader';
import { Spinner } from '@/components/ui/spinner';

const DEFAULT_CENTER: google.maps.LatLngLiteral = {
  lat: 39.8283,
  lng: -98.5795,
};

export type SiteForOverviewMap = {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
};

function mapOverviewOptions(): google.maps.MapOptions {
  return {
    mapTypeId: google.maps.MapTypeId.HYBRID,
    streetViewControl: false,
    mapTypeControl: false,
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

type MapPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
};

function toPins(sites: SiteForOverviewMap[]): MapPin[] {
  return sites
    .map((s) => {
      if (s.latitude == null || s.longitude == null) return null;
      const lat =
        typeof s.latitude === 'number' ? s.latitude : Number(s.latitude);
      const lng =
        typeof s.longitude === 'number' ? s.longitude : Number(s.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return { id: s.id, name: s.name, lat, lng, status: s.status ?? '' };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);
}

/** Run after layout/tiles so fitBounds uses a real map size (avoids full-continent zoom). */
function fitMapToPinsWhenIdle(map: google.maps.Map, pinList: MapPin[]) {
  if (pinList.length === 0) return;

  const apply = () => {
    if (pinList.length === 1) {
      map.setCenter({ lat: pinList[0].lat, lng: pinList[0].lng });
      map.setZoom(12);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of pinList) {
      bounds.extend({ lat: p.lat, lng: p.lng });
    }
    map.fitBounds(bounds, { top: 72, right: 56, bottom: 56, left: 56 });
  };

  google.maps.event.addListenerOnce(map, 'idle', apply);
}

type SitesOverviewMapProps = {
  sites: SiteForOverviewMap[];
};

export function SitesOverviewMap({ sites }: SitesOverviewMapProps) {
  const router = useRouter();
  const apiKey = getGoogleMapsBrowserKey();
  const mapRef = useRef<google.maps.Map | null>(null);
  const pinsRef = useRef<MapPin[]>([]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
  });

  const pins = useMemo(() => toPins(sites), [sites]);
  const withoutCoords = sites.length - pins.length;

  pinsRef.current = pins;

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    fitMapToPinsWhenIdle(map, pinsRef.current);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded || pins.length === 0) return;
    fitMapToPinsWhenIdle(map, pins);
  }, [isLoaded, pins]);

  if (!apiKey) {
    return (
      <div className='rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground'>
        Set{' '}
        <code className='rounded bg-muted px-1 py-0.5 text-xs'>
          NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY
        </code>{' '}
        with the Maps JavaScript API enabled to show all sites on a map.
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className='rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground'>
        No sites have GPS coordinates yet. Add latitude and longitude under{' '}
        <strong className='font-medium text-foreground'>Admin → Sites</strong>{' '}
        to see them here.
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
        className='flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground aspect-[4/3] min-h-[200px]'
        role='status'
        aria-live='polite'
      >
        <Spinner size='md' />
        <span>Loading map…</span>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <div className='relative w-full overflow-hidden rounded-md border border-border aspect-[4/3] min-h-[400px]'>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%', minHeight: '400px' }}
          center={DEFAULT_CENTER}
          zoom={4}
          options={mapOverviewOptions()}
          onLoad={onMapLoad}
          clickableIcons={false}
          
        >
          {pins.map((p) => (
            <Fragment key={p.id}>
              <OverlayView
                position={{ lat: p.lat, lng: p.lng }}
                mapPaneName={OVERLAY_MOUSE_TARGET}
              >
                {/*
                  OverlayView’s map pane often gives children no box width, so max-w on the button only caps
                  width and never widens. Fixed-width wrapper + w-full button makes labels consistently wider.
                */}
                <div
                  className='pointer-events-none'
                  style={{
                    width: 'min(10rem, calc(100vw - 3rem))',
                    transform: 'translate(-50%, calc(-100% - 2.75rem))',
                  }}
                >
                  <button
                    type='button'
                    className={cn(
                      'pointer-events-auto w-full rounded-md border px-2 py-1 text-center text-xs font-medium leading-snug shadow-sm hover:brightness-[0.97] dark:hover:brightness-110',
                      siteStatusSurfaceClassName(p.status),
                    )}
                    onClick={() => {
                      router.push(`/sites/${p.id}`);
                    }}
                  >
                    {p.name}
                  </button>
                </div>
              </OverlayView>
              <Marker
                position={{ lat: p.lat, lng: p.lng }}
                title={p.name}
                onClick={() => {
                  router.push(`/sites/${p.id}`);
                }}
              />
            </Fragment>
          ))}
        </GoogleMap>
      </div>
      <p className='text-xs text-muted-foreground'>
        Click the pin or site name to open the site.
        {withoutCoords > 0
          ? `| ${withoutCoords} site${withoutCoords === 1 ? ' has' : 's have'} no coordinates and ${withoutCoords === 1 ? 'is' : 'are'} not shown.`
          : null}
      </p>
    </div>
  );
}
