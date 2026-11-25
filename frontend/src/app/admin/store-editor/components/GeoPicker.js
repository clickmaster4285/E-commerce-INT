"use client";

/* ==========================================================
   STORE EDITOR — "geo" field (Leaflet + OpenStreetMap)
   Do mode:
     • pin  (default)        → value { lat, lng } — map par click / pin drag
     • view (withZoom: true) → value { lat, lng, zoom } — seller jo area /
       zoom dikhata hai wahi save (customer ko pehle yahi dikhega)
   Address search OSM Nominatim se (sirf button / Enter par — 1 req/sec policy).
   Leaflet window chahiye → module sirf client par (fields.js dynamic ssr:false).
   ========================================================== */

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, Search, Trash2 } from "lucide-react";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const WORLD = { lat: 30, lng: 70, zoom: 4 };

const inputCls =
  "h-9 w-full rounded-lg border border-line bg-input px-3 text-sm text-fg outline-none transition placeholder:text-fg-muted focus:border-accent focus:ring-2 focus:ring-accent/20";

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const isGeo = (v) => v && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng));
const same = (a, b) =>
  isGeo(a) && isGeo(b) && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6 && (a.zoom ?? null) === (b.zoom ?? null);

// Accent rang ka pin (theme token) — default Leaflet PNG icons bundler me toot jate hain
export const pinHtml = (cls) =>
  `<span class="${cls}" style="display:block;width:30px;height:40px;filter:drop-shadow(0 2px 3px rgb(0 0 0 / .35))"><svg viewBox="0 0 24 32" width="30" height="40"><path fill="currentColor" d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z"/><circle cx="12" cy="12" r="4.6" fill="#fff"/></svg></span>`;

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("search failed");
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

export default function GeoPicker({ value, onChange, withZoom = false, fallbackCenter = null }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const LRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const syncingRef = useRef(false); // hum khud setView kar rahe → moveend ko ignore
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  });

  // ── Map ek hi baar banao ──
  useEffect(() => {
    let cancelled = false;
    let observer;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !boxRef.current) return;
      LRef.current = L;
      const start = isGeo(value) ? value : isGeo(fallbackCenter) ? { ...fallbackCenter, zoom: 13 } : WORLD;
      const map = L.map(boxRef.current, { scrollWheelZoom: true, attributionControl: true });
      map.attributionControl.setPrefix(false);
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
      syncingRef.current = true;
      map.setView([start.lat, start.lng], start.zoom ?? (isGeo(value) ? 15 : WORLD.zoom));
      syncingRef.current = false;
      mapRef.current = map;
      setReady(true);

      if (withZoom) {
        // View mode: jo area seller dikhaye wahi value
        map.on("moveend", () => {
          if (syncingRef.current) return;
          const c = map.getCenter();
          const next = { lat: round6(c.lat), lng: round6(c.lng), zoom: map.getZoom() };
          if (!same(next, valueRef.current)) onChangeRef.current(next);
        });
      } else {
        map.on("click", (e) => onChangeRef.current({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) }));
      }

      // Sidebar panel resize / collapse → tiles dobara fit
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(boxRef.current);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withZoom]);

  // ── value bahar se badli (reset / search / typed coords) → map sync ──
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    if (withZoom) {
      if (!isGeo(value)) return;
      const c = map.getCenter();
      if (same({ lat: round6(c.lat), lng: round6(c.lng), zoom: map.getZoom() }, value)) return;
      syncingRef.current = true;
      map.setView([value.lat, value.lng], value.zoom ?? 13);
      syncingRef.current = false;
      return;
    }
    if (!isGeo(value)) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const latlng = [Number(value.lat), Number(value.lng)];
    if (!markerRef.current) {
      const icon = L.divIcon({ html: pinHtml("text-accent"), className: "", iconSize: [30, 40], iconAnchor: [15, 40] });
      markerRef.current = L.marker(latlng, { icon, draggable: true, autoPan: true }).addTo(map);
      markerRef.current.on("dragend", (e) => {
        const p = e.target.getLatLng();
        onChangeRef.current({ lat: round6(p.lat), lng: round6(p.lng) });
      });
    } else {
      markerRef.current.setLatLng(latlng);
    }
    if (!map.getBounds().pad(-0.1).contains(latlng)) map.panTo(latlng);
  }, [value, withZoom, ready]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError("");
    try {
      const rows = await geocode(q);
      setResults(rows);
      if (!rows.length) setError("No place found. Try a shorter address or click the map.");
    } catch {
      setError("Search is unavailable right now. Click the map instead.");
    } finally {
      setSearching(false);
    }
  };

  const pick = (row) => {
    setResults(null);
    const map = mapRef.current;
    if (withZoom) {
      onChange({ lat: round6(row.lat), lng: round6(row.lng), zoom: 15 });
    } else {
      onChange({ lat: round6(row.lat), lng: round6(row.lng) });
      map?.setView([row.lat, row.lng], Math.max(map.getZoom(), 16));
    }
  };

  const setCoord = (key, raw) => {
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) return;
    const base = isGeo(value) ? value : withZoom ? { lat: 0, lng: 0, zoom: 13 } : { lat: 0, lng: 0 };
    onChange({ ...base, [key]: round6(n) });
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex gap-1.5">
          <input
            className={inputCls}
            placeholder="Search an address or place…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            aria-label="Search"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-fg-secondary transition hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </div>
        {results?.length ? (
          <ul className="absolute inset-x-0 top-10 z-[1000] max-h-56 overflow-auto rounded-lg border border-line bg-card py-1 shadow-lg">
            {results.map((r, i) => (
              <li key={i}>
                <button type="button" onClick={() => pick(r)} className="block w-full px-3 py-2 text-start text-xs text-fg hover:bg-subtle">
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? <p className="text-[11px] font-medium text-warning">{error}</p> : null}

      <div className="relative">
        <div ref={boxRef} dir="ltr" className="z-0 h-56 w-full overflow-hidden rounded-lg border border-line bg-subtle" />
        {withZoom ? (
          // View mode: center ka nishaan — "yahi beech hoga"
          <Crosshair size={18} className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2 text-accent" />
        ) : null}
      </div>
      <p className="text-[11px] text-fg-muted">
        {withZoom
          ? "Drag and zoom the map. The area you see is what customers see first."
          : isGeo(value)
            ? "Drag the pin to adjust it."
            : "Click the map to drop the pin."}
      </p>

      <div className="flex items-center gap-1.5">
        <input
          className={inputCls}
          inputMode="decimal"
          aria-label="Latitude"
          placeholder="Latitude"
          key={`lat-${value?.lat ?? ""}`}
          defaultValue={isGeo(value) ? value.lat : ""}
          onBlur={(e) => setCoord("lat", e.target.value)}
        />
        <input
          className={inputCls}
          inputMode="decimal"
          aria-label="Longitude"
          placeholder="Longitude"
          key={`lng-${value?.lng ?? ""}`}
          defaultValue={isGeo(value) ? value.lng : ""}
          onBlur={(e) => setCoord("lng", e.target.value)}
        />
        {withZoom && isGeo(value) ? (
          <span className="shrink-0 rounded-md bg-subtle px-1.5 py-1 text-[11px] font-semibold tabular-nums text-fg" title="Zoom level">
            z{value.zoom ?? 13}
          </span>
        ) : null}
        {isGeo(value) ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove"
            title="Remove"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-danger transition hover:bg-subtle"
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
