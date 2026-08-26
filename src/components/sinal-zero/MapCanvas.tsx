import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import type { Establishment } from "@/lib/types";

interface MapCanvasProps { places: Establishment[]; selectedId: string | null; onSelect: (id: string) => void; center: { lat: number; lon: number } | null; }
function readThemeColor(name: string, fallback: string): string { if (typeof window === "undefined") return fallback; const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return value || fallback; }

export default function MapCanvas({ places, selectedId, onSelect, center }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const signature = useMemo(() => places.map((p) => `${p.id}:${p.lat}:${p.lon}:${p.level}`).join("|"), [places]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const map = L.map(container, { center: [-14.235, -51.925], zoom: 4, zoomControl: true, preferCanvas: true, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize({ animate: false })) : null;
    resizeObserver?.observe(container);
    const timers = [50, 250, 700].map((ms) => window.setTimeout(() => map.invalidateSize({ animate: false }), ms));
    return () => {
      resizeObserver?.disconnect();
      timers.forEach(clearTimeout);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    const renderer = L.canvas({ padding: 0.5 });
    const bounds: [number, number][] = [];
    const markerColors = { zero: readThemeColor("--signal-zero", "orange"), weak: readThemeColor("--signal-weak", "gold"), full: readThemeColor("--cyan", "cyan"), stroke: readThemeColor("--background", "black") };
    for (const place of places) {
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
      const marker = L.circleMarker([place.lat, place.lon], { renderer, radius: 7, weight: 2, color: markerColors.stroke, fillColor: markerColors[place.level] ?? markerColors.zero, fillOpacity: 0.95 });
      marker.on("click", () => onSelectRef.current(place.id));
      marker.bindTooltip(place.name, { direction: "top", offset: [0, -6] });
      marker.addTo(layer);
      markersRef.current.set(place.id, marker);
      bounds.push([place.lat, place.lon]);
    }
    window.setTimeout(() => map.invalidateSize({ animate: false }), 0);
    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds).pad(0.12), { animate: false, maxZoom: 15 });
    else if (center) map.setView([center.lat, center.lon], 13, { animate: false });
  }, [signature, center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker, id) => {
      const active = id === selectedId;
      marker.setStyle({ radius: active ? 11 : 7, weight: active ? 3 : 2, color: active ? readThemeColor("--foreground", "white") : readThemeColor("--background", "black") });
      if (active) { marker.bringToFront(); map.panTo(marker.getLatLng(), { animate: true, duration: 0.4 }); }
    });
  }, [selectedId, signature]);

  return <div ref={containerRef} className="h-full min-h-[320px] w-full" />;
}
