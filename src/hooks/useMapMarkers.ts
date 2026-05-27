"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

import { Point } from "@/src/types/point";
import { createCategoryIcon } from "@/src/lib/map/icons";

type UseMapMarkersProps = {
  map: L.Map | null;
  points: Point[];
  activeCategory: Point["category"] | null;
};

export function useMapMarkers({
  map,
  points,
  activeCategory,
}: UseMapMarkersProps) {
  const layerRef = useRef<L.LayerGroup | null>(null);

  /*
  ================================================================================
  📍 Init LayerGroup (once map exists)
  ================================================================================
  */
  useEffect(() => {
    if (!map) return;

    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      layerRef.current?.remove();
    };
  }, [map]);

  /*
  ================================================================================
  📍 Update markers when category or points change
  ================================================================================
  */
  useEffect(() => {
    if (!map || !layerRef.current) return;

    // ניקוי markers ישנים
    layerRef.current.clearLayers();

    // פילטור נקודות
    const filteredPoints = activeCategory
      ? points.filter(
          (p) => p.category === activeCategory
        )
      : points;

    // יצירת markers חדשים
    filteredPoints.forEach((point) => {
      const marker = L.marker(point.coords, {
        icon: createCategoryIcon(point.category),
      }).bindPopup(point.name);

      layerRef.current?.addLayer(marker);
    });
  }, [map, points, activeCategory]);
}