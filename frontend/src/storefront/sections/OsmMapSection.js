"use client";

/* ==========================================================
   STORE EDITOR — "osm_map" section (Leaflet + OpenStreetMap)
   Google "map" section (MoreSections.js) se alag, woh waisa hi hai.
   • blocks = locations (name / pin / address / phone / hours)
   • fitPins → saare pins dikhe; warna seller ka chuna hua view { lat, lng, zoom }
   • list item click → map us pin par jata hai + popup
   Leaflet window chahiye → useEffect me dynamic import (SSR safe).
   Popup DOM nodes + textContent se banta hai (seller text kabhi HTML nahi).
   Sirf --user-* tokens.
   ========================================================== */

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import SectionHeading from "@/components/user/SectionHeading";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useStoreTheme } from "../ThemeProvider";

const MAP_HEIGHT = { small: "h-56", medium: "h-80", large: "h-[28rem]" };
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const PIN_HTML =
  '<span class="text-user-accent" style="display:block;width:30px;height:40px;filter:drop-shadow(0 2px 3px rgb(0 0 0 / .35))"><svg viewBox="0 0 24 32" width="30" height="40"><path fill="currentColor" d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z"/><circle cx="12" cy="12" r="4.6" fill="#fff"/></svg></span>';

const isGeo = (v) => v && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng));
const directionsUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;

function popupNode(loc, labels) {
  const root = document.createElement("div");
  root.className = "min-w-40 space-y-1 text-xs";
  const add = (tag, text, cls) => {
    if (!text) return null;
    const el = document.createElement(tag);
    el.textContent = text;
    if (cls) el.className = cls;
    root.appendChild(el);
    return el;
  };
  add("p", loc.name, "!m-0 text-sm font-semibold");
  add("p", loc.address, "!m-0 whitespace-pre-line");
  add("p", loc.hours, "!m-0 opacity-75");
  const links = document.createElement("p");
  links.className = "!m-0 flex flex-wrap gap-3 pt-1 font-semibold";
  if (loc.phone) {
    const a = document.createElement("a");
    a.href = telHref(loc.phone);
    a.textContent = loc.phone;
    links.appendChild(a);
  }
  const dir = document.createElement("a");
  dir.href = directionsUrl(loc.location);
  dir.target = "_blank";
  dir.rel = "noopener noreferrer";
  dir.textContent = labels.directions;
  links.appendChild(dir);
  root.appendChild(links);
  return root;
}

export default function OsmMapSection({ settings = {}, blocks = [] }) {
  const { isPreview } = useStoreTheme();
  const { t } = useTranslation();
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  const locations = useMemo(
    () =>
      (blocks || [])
        .map((b) => ({ id: b.id, ...(b.settings || {}) }))
        .filter((l) => isGeo(l.location))
        .map((l) => ({ ...l, location: { lat: Number(l.location.lat), lng: Number(l.location.lng) } })),
    [blocks],
  );
  const view = isGeo(settings.view) ? settings.view : null;
  const fitPins = settings.fitPins !== false;
  const scrollZoom = Boolean(settings.scrollZoom);
  const directions = t("storefront.map.directions");
  // Rebuild key — settings / pins badle (editor preview) to map dobara bane
  const signature = JSON.stringify([locations, view, fitPins, scrollZoom]);

  useEffect(() => {
    if (!locations.length && !view) return undefined;
    let cancelled = false;
    let observer;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !boxRef.current) return;
      const map = L.map(boxRef.current, {
        scrollWheelZoom: scrollZoom,
        // Mobile par ek ungli se page scroll ho, map nahi (do ungli zoom chalta hai)
        dragging: !L.Browser.mobile,
        tap: !L.Browser.mobile,
      });
      map.attributionControl.setPrefix(false);
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

      const icon = L.divIcon({ html: PIN_HTML, className: "", iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -36] });
      const markers = {};
      for (const loc of locations) {
        const m = L.marker([loc.location.lat, loc.location.lng], { icon, title: loc.name || "", alt: loc.name || "" }).addTo(map);
        m.bindPopup(() => popupNode(loc, { directions }));
        markers[loc.id] = m;
      }
      markersRef.current = markers;

      if (fitPins && locations.length > 1) {
        map.fitBounds(L.latLngBounds(locations.map((l) => [l.location.lat, l.location.lng])), { padding: [40, 40], maxZoom: 16 });
      } else if (fitPins && locations.length === 1) {
        map.setView([locations[0].location.lat, locations[0].location.lng], 15);
      } else if (view) {
        map.setView([view.lat, view.lng], view.zoom ?? 13);
      } else {
        map.fitBounds(L.latLngBounds(locations.map((l) => [l.location.lat, l.location.lng])), { padding: [40, 40], maxZoom: 16 });
      }
      mapRef.current = map;
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(boxRef.current);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, directions]);

  if (!locations.length && !view) {
    return isPreview ? (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-user-line px-4 text-center text-sm text-user-fg-muted">
        Add a location and drop its pin in the store editor
      </div>
    ) : null;
  }

  const focus = (loc) => {
    const map = mapRef.current;
    const marker = markersRef.current[loc.id];
    if (!map || !marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.6 });
    marker.openPopup();
    boxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const showList = settings.showList !== false && locations.length > 0;

  return (
    <section>
      {settings.heading ? <SectionHeading title={settings.heading} className="mb-4 px-1" /> : null}
      <div
        ref={boxRef}
        dir="ltr"
        className={`isolate z-0 overflow-hidden rounded-2xl border border-user-line bg-user-card ${MAP_HEIGHT[settings.height] || MAP_HEIGHT.medium}`}
      />
      {showList ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <li key={loc.id} className="rounded-2xl border border-user-line bg-user-card p-4">
              <button type="button" onClick={() => focus(loc)} className="flex w-full items-start gap-2 text-start">
                <MapPin size={16} className="mt-0.5 shrink-0 text-user-accent" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-user-fg">{loc.name || loc.address || directions}</span>
                  {loc.address && loc.name ? (
                    <span className="mt-0.5 block whitespace-pre-line text-xs text-user-fg-muted">{loc.address}</span>
                  ) : null}
                </span>
              </button>
              {loc.hours ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-user-fg-muted">
                  <Clock size={13} className="shrink-0" /> {loc.hours}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold">
                {loc.phone ? (
                  <a href={telHref(loc.phone)} className="inline-flex items-center gap-1.5 text-user-accent hover:underline">
                    <Phone size={13} /> <span dir="ltr">{loc.phone}</span>
                  </a>
                ) : null}
                <a
                  href={directionsUrl(loc.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-user-accent hover:underline"
                >
                  <Navigation size={13} /> {directions}
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
