"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { points } from "@/src/data/points";
import { useMapMarkers } from "@/src/hooks/useMapMarkers";
import { Point } from "@/src/types/point";

type MapProps = {
  activeCategory: Point["category"] | null;
};

export default function Map({
  activeCategory,
}: MapProps) {
  const mapRef =
    useRef<HTMLDivElement | null>(null);

  const [map, setMap] = useState<L.Map | null>(null);

  /*
  ================================================================================
  🌍 Create map once
  ================================================================================
  */
  useEffect(() => {
    if (!mapRef.current) return;

    if ((mapRef.current as any)._leaflet_id) {
      (mapRef.current as any)._leaflet_id = null;
    }

    const newMap = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: 18,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          "&copy; OpenStreetMap & CARTO",
      }
    ).addTo(newMap);

    setMap(newMap);

    return () => {
      newMap.remove();
    };
  }, []);

  /*
  ================================================================================
  📍 Use markers hook
  ================================================================================
  */
  useMapMarkers({
    map,
    points,
    activeCategory,
  });

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "70vh",
        borderRadius: "24px",
        overflow: "hidden",
        background: "#000",
      }}
    />
  );
}