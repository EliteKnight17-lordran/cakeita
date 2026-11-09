import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from '../../domain/geo';
import type { BakeryMatch } from '../../domain/matching';
import { formatPeso } from '../../domain/money';

/**
 * Map of nearby bakers. Loaded lazily (Leaflet is only downloaded on this page).
 * Map pictures (tiles) need internet; markers, prices and the list below work without it.
 * Tiles: OpenStreetMap's own tiles (free, no key, light use per their tile policy), falling back
 * to OpenStreetMap France's Humanitarian style. CARTO was dropped: it now asks for an API key.
 */

const TILES = [
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
  },
  {
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles by <a href="https://www.openstreetmap.fr/">OSM France</a>',
    subdomains: 'abc',
  },
];

export interface BakeryMapProps {
  spot: LatLng & { label: string };
  matches: BakeryMatch[];
  selected: string | null;
  radiusKm: number | null;
  onSelect: (slug: string) => void;
  onMoveSpot: (p: LatLng) => void;
  labels: { you: string; tapHint: string; offline: string };
}

/** Short bakery name for a pin (the list below the map shows the full name and the "(sample)" label). */
export function pinName(name: string): string {
  const short = name.replace(/\s*\(sample\)\s*$/i, '').trim();
  const cut = short.length > 18 ? `${short.slice(0, 17).trimEnd()}…` : short;
  return cut.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function pinClass(m: BakeryMatch, selected: boolean) {
  if (selected) return 'pin pin-selected';
  if (!m.suitable) return 'pin pin-no';
  return m.fitsBudget === false ? 'pin pin-over' : 'pin pin-ok';
}

function PanToSelected({ selected, matches }: { selected: string | null; matches: BakeryMatch[] }) {
  const map = useMap();
  useEffect(() => {
    const m = matches.find((x) => x.slug === selected);
    if (m) map.panTo([m.lat, m.lng], { animate: true });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Zoom to show your pin and the shown bakers whenever the list changes size (distance, filters). */
function FitAll({ spot, matches }: { spot: LatLng; matches: BakeryMatch[] }) {
  const map = useMap();
  const key = `${spot.lat},${spot.lng}|${matches.map((m) => m.slug).sort().join(',')}`;
  useEffect(() => {
    const pts: Array<[number, number]> = [[spot.lat, spot.lng], ...matches.map((m) => [m.lat, m.lng] as [number, number])];
    if (pts.length < 2) map.setView([spot.lat, spot.lng], 13, { animate: false });
    else map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14, animate: false });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickToMove({ onMove }: { onMove: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export default function BakeryMap({ spot, matches, selected, radiusKm, onSelect, onMoveSpot, labels }: BakeryMapProps) {
  const [tileIdx, setTileIdx] = useState(0);
  const [tilesDown, setTilesDown] = useState(false);
  const errors = useRef(0);
  const loaded = useRef(0);
  const tile = TILES[tileIdx]!;

  // Some networks and blockers make tiles hang instead of failing. If nothing has drawn after a
  // few seconds, try the next map provider, then say so (pins and the list still work).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (loaded.current > 0) return;
      errors.current = 0;
      if (tileIdx < TILES.length - 1) setTileIdx(tileIdx + 1);
      else setTilesDown(true);
    }, 7000);
    return () => window.clearTimeout(t);
  }, [tileIdx]);

  const youIcon = useMemo(() => L.divIcon({ className: '', html: '<span class="pin-you" aria-hidden="true"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }), []);
  const icons = useMemo(
    () =>
      new Map(
        matches.map((m) => [
          m.slug,
          L.divIcon({
            className: '',
            html: `<span class="${pinClass(m, m.slug === selected)}"><span class="pin-name">${pinName(m.name)}</span>${m.estimate != null ? formatPeso(m.estimate) : '?'}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        ]),
      ),
    [matches, selected],
  );

  return (
    <div className="relative">
      <MapContainer center={[spot.lat, spot.lng]} zoom={12} scrollWheelZoom={false} className="cakeita-map" attributionControl>
        <TileLayer
          key={tile.url}
          url={tile.url}
          attribution={tile.attribution}
          subdomains={tile.subdomains}
          maxZoom={19}
          eventHandlers={{
            tileload: () => {
              loaded.current++;
              if (tilesDown) setTilesDown(false);
            },
            tileerror: () => {
              errors.current++;
              if (errors.current >= 4 && loaded.current === 0) {
                if (tileIdx < TILES.length - 1) {
                  errors.current = 0;
                  setTileIdx(tileIdx + 1);
                } else setTilesDown(true);
              }
            },
          }}
        />
        <FitAll spot={spot} matches={matches} />
        <PanToSelected selected={selected} matches={matches} />
        <ClickToMove onMove={onMoveSpot} />
        {radiusKm != null && <Circle center={[spot.lat, spot.lng]} radius={radiusKm * 1000} pathOptions={{ color: '#8c2246', weight: 1.5, fillColor: '#f5e9ec', fillOpacity: 0.18, dashArray: '6 6' }} />}
        <Marker position={[spot.lat, spot.lng]} icon={youIcon} title={labels.you} alt={labels.you} keyboard={false}>
          <Tooltip direction="top" offset={[0, -10]}>{spot.label}</Tooltip>
        </Marker>
        {matches.map((m) => (
          <Marker
            key={m.slug}
            position={[m.lat, m.lng]}
            icon={icons.get(m.slug)}
            title={`${m.name}, ${m.estimate != null ? formatPeso(m.estimate) : ''}`}
            alt={m.name}
            zIndexOffset={m.slug === selected ? 1000 : m.suitable ? 100 : 0}
            eventHandlers={{ click: () => onSelect(m.slug), keypress: (e) => { if ((e.originalEvent as KeyboardEvent).key === 'Enter') onSelect(m.slug); } }}
          />
        ))}
      </MapContainer>
      <p className="pointer-events-none absolute right-2 top-2 z-[500] rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink-soft shadow-sm">{labels.tapHint}</p>
      {tilesDown && <p className="absolute inset-x-2 bottom-8 z-[500] rounded-2xl bg-white/95 p-2 text-center text-sm font-semibold text-ink shadow">{labels.offline}</p>}
    </div>
  );
}
