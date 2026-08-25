import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import type { Establishment } from "@/lib/types";

interface MapCanvasProps {
  places: Establishment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  center: { lat: number; lon: number } | null;
}

const LEVEL_COLOR: Record<string, string> = {
  zero: "#f97316",
  weak: "#eab308",
  full: "#22d3ee",
};

/**
 * Mapa livre (OpenStreetMap + Leaflet), sem chave de API.
 * Renderiza os marcadores em canvas para aguentar centenas de pontos sem travar.
 */
export default function MapCanvas({ places, selectedId, onSelect, center }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Assinatura estável dos pontos: evita redesenhar a camada sem necessidade.
  const signature = useMemo(
    () => places.map((p) => p.id).join("|"),
    [places]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-14.235, -51.925],
      zoom: 4,
      zoomControl: true,
      preferCanvas: true,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Desenha marcadores
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markersRef.current.clear();

    const renderer = L.canvas({ padding: 0.5 });
    const bounds: [number, number][] = [];

    for (const place of places) {
      const marker = L.circleMarker([place.lat, place.lon], {
        renderer,
        radius: 7,
        weight: 2,
        color: "#0b1220",
        fillColor: LEVEL_COLOR[place.level] ?? "#f97316",
        fillOpacity: 0.95,
      });
      marker.on("click", () => onSelectRef.current(place.id));
      marker.bindTooltip(place.name, { direction: "top", offset: [0, -6] });
      marker.addTo(layer);
      markersRef.current.set(place.id, marker);
      bounds.push([place.lat, place.lon]);
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.12), { animate: false });
    } else if (center) {
      map.setView([center.lat, center.lon], 13, { animate: false });
    }
    // signature garante recálculo apenas quando a lista muda de fato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, center]);

  // Destaca e centraliza o selecionado
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker, id) => {
      const active = id === selectedId;
      marker.setStyle({
        radius: active ? 11 : 7,
        weight: active ? 3 : 2,
        color: active ? "#ffffff" : "#0b1220",
      });
      if (active) {
        marker.bringToFront();
        map.panTo(marker.getLatLng(), { animate: true, duration: 0.4 });
      }
    });
  }, [selectedId, signature]);

  return <div ref={containerRef} className="h-full w-full" />;
}
