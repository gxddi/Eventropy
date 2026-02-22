import { useCallback, useEffect, useRef, useState } from "react";
import type { VenueLocation } from "../types";

const PHOTON_API = "https://photon.komoot.io/api/";
const DEBOUNCE_MS = 300;

interface PhotonFeature {
  type: "Feature";
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

function buildAddress(f: PhotonFeature): string {
  const p = f.properties;
  const parts = [
    p.housenumber,
    p.street,
    p.postcode,
    p.city,
    p.state,
    p.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : p.name || "Unknown";
}

function buildMapUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=14`;
}

export default function AddressAutocomplete({
  value,
  onChange,
}: {
  value?: VenueLocation;
  onChange: (location: VenueLocation | undefined) => void;
}) {
  const [query, setQuery] = useState(value?.address ?? "");
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.address ?? "");
  }, [value?.address]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch(
        `${PHOTON_API}?q=${encodeURIComponent(query)}&limit=8&lang=en`
      )
        .then((res) => res.json())
        .then((data: PhotonResponse) => {
          setSuggestions(data.features ?? []);
          setOpen(true);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
      debounceRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const select = useCallback(
    (f: PhotonFeature) => {
      const [lon, lat] = f.geometry.coordinates;
      const address = buildAddress(f);
      onChange({
        address,
        latitude: lat,
        longitude: lon,
        mapUrl: buildMapUrl(lat, lon),
      });
      setQuery(address);
      setOpen(false);
      setSuggestions([]);
    },
    [onChange]
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="address-autocomplete" ref={wrapperRef}>
      <div className="maps-input-wrapper">
        <input
          type="text"
          className="maps-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          placeholder="City, country or full address..."
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && <span className="maps-loading" aria-hidden />}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="maps-predictions" role="listbox">
          {suggestions.map((f, i) => (
            <li
              key={i}
              className="maps-prediction-item"
              role="option"
              onClick={() => select(f)}
            >
              {buildAddress(f)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
