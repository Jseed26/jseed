"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { Point } from "@/src/types/point";
import { createCategoryIcon } from "@/src/lib/map/icons";

type Props = {
  map: L.Map | null;
  points: Point[];
  activeCategory: Point["category"] | null;
};

export function useMapMarkers({ map, points, activeCategory }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      layerRef.current?.remove();
    };
  }, [map]);

  function createPopup(point: Point) {
    return `
      <div style="min-width:220px">

        <h3 style="font-weight:bold;font-size:16px;margin-bottom:8px">
          ${point.name}
        </h3>

        ${
          point.imageUrl && point.imageUrl.trim() !== ""
            ? `
          <img
            src="${point.imageUrl}"
            style="
              width:100%;
              max-height:140px;
              object-fit:cover;
              border-radius:8px;
              margin-bottom:10px;
            "
          />
        `
            : ""
        }

        <p><strong>תיאור:</strong><br/>${point.description || "-"}</p>

        <p style="margin-top:8px">
          <strong>כתובת:</strong><br/>${point.address || "-"}</p>

        <p style="margin-top:8px">
          <strong>קישור:</strong><br/>
          ${
            point.website
              ? `<a href="${point.website}" target="_blank">למעבר</a>`
              : "-"
          }
        </p>

      </div>
    `;
  }

  useEffect(() => {
    if (!map || !layerRef.current) return;

    layerRef.current.clearLayers();

    const filtered = activeCategory
      ? points.filter((p) => p.category === activeCategory)
      : points;

    filtered.forEach((point) => {
      console.log("POINT IMAGE:", point.imageUrl); // 👈 דיבוג חשוב

      const marker = L.marker(
        [point.latitude, point.longitude],
        {
          icon: createCategoryIcon(point.category),
        }
      );

      marker.bindPopup(createPopup(point));

      marker.on("click", () => {
        marker.openPopup();
      });

      layerRef.current?.addLayer(marker);
    });
  }, [map, points, activeCategory]);
}