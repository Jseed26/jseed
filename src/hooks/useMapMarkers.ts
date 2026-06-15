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
      <div style="
        width:240px;
        font-family: Arial, sans-serif;
        border-radius:14px;
        overflow:hidden;
        box-shadow:0 10px 25px rgba(0,0,0,0.25);
        background:#fff;
      ">

        ${
          point.imageUrl && point.imageUrl.trim() !== ""
            ? `
          <div style="width:100%; height:130px; overflow:hidden;">
            <img
              src="${point.imageUrl}"
              style="
                width:100%;
                height:100%;
                object-fit:cover;
              "
            />
          </div>
        `
            : ""
        }

        <div style="padding:12px">

          <h3 style="
            margin:0;
            font-size:16px;
            font-weight:700;
            color:#111;
          ">
            ${point.name}
          </h3>

          <p style="
            margin:6px 0 10px;
            font-size:13px;
            color:#555;
            line-height:1.4;
          ">
            ${point.description || "אין תיאור"}
          </p>

          <div style="font-size:12px; color:#666; margin-bottom:6px">
            📍 ${point.address || "אין כתובת"}
          </div>

          ${
            point.website
              ? `
            <a href="${point.website}" target="_blank"
              style="
                display:inline-block;
                margin-top:8px;
                padding:6px 10px;
                background:#111;
                color:#fff;
                border-radius:8px;
                text-decoration:none;
                font-size:12px;
              ">
              לפתיחת קישור
            </a>
          `
              : ""
          }

        </div>
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
      const marker = L.marker(
        [point.latitude, point.longitude],
        {
          icon: createCategoryIcon(point.category),
        }
      );

      marker.bindPopup(createPopup(point), {
        closeButton: true,
        className: "custom-popup",
      });

      marker.on("click", () => {
        marker.openPopup();
      });

      layerRef.current?.addLayer(marker);
    });
  }, [map, points, activeCategory]);
}