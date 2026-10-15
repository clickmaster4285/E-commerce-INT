"use client";

import { useState, useCallback } from "react";

export function useCurrentLocation() {
  const [loading, setLoading] = useState(false);

  const fetchLocation = useCallback(async () => {
    setLoading(true);

    const dedup = (arr) => {
      const s = new Set();
      return arr.filter((v) => { if (!v || s.has(v)) return false; s.add(v); return true; });
    };

    // Insecure context — cannot access GPS
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.geolocation) {
      setLoading(false);
      return { ok: false, reason: "insecure" };
    }

    // GPS → Nominatim
    let lat, lon;
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => { lat = pos.coords.latitude; lon = pos.coords.longitude; resolve(); },
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    } catch (err) {
      setLoading(false);
      const reason = err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable";
      return { ok: false, reason };
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lon}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const json = await res.json();
        const a = json?.address;
        if (a && (a.road || a.city || a.state || a.postcode)) {
          const street = [a.house_number, a.road, a.suburb || a.quarter || a.neighbourhood || a.city_block].filter(Boolean).join(", ");
          setLoading(false);
          return { ok: true, data: {
            street,
            stateName: a.state || "",
            cityCandidates: dedup([a.city, a.municipality, a.county, a.state_district, a.town, a.village, a.state]),
            postal: a.postcode || "",
            countryName: a.country || "",
            source: "gps",
          }};
        }
      }
    } catch {
      // Nominatim failed
    }

    setLoading(false);
    return { ok: false, reason: "unavailable" };
  }, []);

  return { loading, fetchLocation };
}
