"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { Point } from "@/src/types/point";
import { createCategoryIcon } from "@/src/lib/map/icons";

type Props = {
  map: L.Map | null;
  points: Point[];
  activeCategory: Point["category"] | null;
  viewedIds: number[];
  savedIds?: number[];
};

export function useMapMarkers({ map, points, activeCategory, viewedIds = [], savedIds = [] }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      layerRef.current?.remove();
    };
  }, [map]);

  // יצירת אלמנט HTML אמיתי (Node) במקום טקסט
  function createPopupNode(point: Point, isSaved: boolean) {
    const container = document.createElement("div");
    container.style.width = "220px";
    container.style.fontFamily = "sans-serif";
    container.dir = "rtl";

    const imageHtml = point.imageUrl 
      ? `<img src="${point.imageUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />` 
      : "";

    const display = (val: string | null | undefined) => (val && val.trim() !== "" ? val : "-");
    const heartIcon = isSaved ? "❤️" : "🤍";

    // מכניסים את התוכן לתוך הקונטיינר שיצרנו
    container.innerHTML = `
      ${imageHtml}
      <div style="max-height: 100px; overflow-y: auto; padding-right: 5px; font-size: 14px;">
        <div style="margin-bottom: 6px;"><strong>שם:</strong> ${display(point.name)}</div>
        <div style="margin-bottom: 6px;"><strong>תיאור:</strong> ${display(point.description)}</div>
        <div style="margin-bottom: 6px;"><strong>מיקום:</strong> ${display(point.address)}</div>
        <div style="margin-bottom: 6px;"><strong>קישור:</strong> ${
          point.website 
            ? `<a href="${point.website}" target="_blank" style="color: blue;">למעבר לאתר</a>` 
            : "-"
        }</div>
      </div>
      
      <div style="margin-top: 8px; text-align: left; border-top: 1px solid #eee; padding-top: 6px;">
        <button class="save-point-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 0; outline: none;">
          ${heartIcon}
        </button>
      </div>
    `;

    // עכשיו, כשהאלמנט קיים בזיכרון, מחברים את הלחיצה לכפתור הלב באופן ישיר!
    const btn = container.querySelector(".save-point-btn") as HTMLButtonElement;
    if (btn) {
      btn.onclick = async () => {
        try {
          const res = await fetch("/api/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pointId: point.id }) // המזהה נלקח ישירות מהנקודה
          });

          if (res.ok) {
            const data = await res.json();
            
            // שינוי האייקון באופן מיידי
            btn.innerText = data.saved ? "❤️" : "🤍";
            
            // עדכון שאר האפליקציה שהייתה שמירה
            window.dispatchEvent(new Event("points-updated"));
          } else {
            alert("צריך להתחבר כדי לשמור נקודות");
          }
        } catch (err) {
          console.error("Failed to toggle save point:", err);
        }
      };
    }

    return container; // מחזירים את האלמנט השלם למפה
  }

  useEffect(() => {
    if (!map || !layerRef.current) return;

    layerRef.current.clearLayers();

    const filtered = activeCategory
      ? points.filter((p) => p.category === activeCategory)
      : points;

    filtered.forEach((point) => {
      const isViewed = viewedIds.includes(point.id);
      const isSaved = savedIds.includes(point.id);

      const marker = L.marker(
        [point.latitude, point.longitude],
        {
          icon: createCategoryIcon(point.category, isViewed),
        }
      );

      // במקום להעביר string, אנחנו מעבירים את ה-Node האמיתי
      marker.bindPopup(createPopupNode(point, isSaved), {
        closeButton: true,
        className: "custom-popup",
      });

      marker.on("click", () => {
        marker.openPopup();
        marker.setIcon(createCategoryIcon(point.category, true));

        if (point.id) {
          fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pointId: point.id }),
          }).catch((err) => console.error("Failed to save history:", err));
        }
      });

      layerRef.current?.addLayer(marker);
    });
  }, [map, points, activeCategory, viewedIds, savedIds]);
}