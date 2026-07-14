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
    
    const plantIconSrc = isSaved 
      ? "/icons/ui/plant/active.png" 
      : "/icons/ui/plant/default.png";

    // 👈 שומרים משתנה מקומי עם כמות השמירות הנוכחית שמגיעה מה-DB
    let currentSavedCount = point._count?.savedBy || 0;

    // מכניסים את התוכן לתוך הקונטיינר
    container.innerHTML = `
      ${imageHtml}
      <div style="max-height: 100px; overflow-y: auto; padding-right: 5px; font-size: 14px;">
        <div style="margin-bottom: 6px;"><strong>שם:</strong> ${display(point.name)}</div>
        <div style="margin-bottom: 6px;"><strong>תיאור:</strong> ${display(point.description)}</div>
        <div style="margin-bottom: 6px;"><strong>מיקום:</strong> ${display(point.address)}</div>
        <div style="margin-bottom: 6px;"><strong>קישור:</strong> ${point.website
        ? `<a href="${point.website}" target="_blank" class="point-website-link" data-id="${point.id}" style="color: blue;">למעבר לאתר</a>`
        : "-"
      }</div>
      </div>
      
      <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 6px; display: flex; items-center: center; justify-content: space-between; align-items: center;">
        
        <span class="saved-count-text" style="font-size: 12px; color: #888; font-weight: bold;">
          ${currentSavedCount} שמירות
        </span>

        <button class="save-point-btn" style="background: none; border: none; cursor: pointer; padding: 0; outline: none; display: flex; align-items: center; justify-content: center;">
          <img src="${plantIconSrc}" alt="Save" style="width: 28px; height: 28px; object-fit: contain; transition: transform 0.2s;" />
        </button>
      </div>
    `;

    const btn = container.querySelector(".save-point-btn") as HTMLButtonElement;
    const countText = container.querySelector(".saved-count-text") as HTMLSpanElement; // תופסים את אלמנט המונה

    if (btn) {
      btn.onclick = async () => {
        const img = btn.querySelector("img");
        if (img) img.style.transform = "scale(0.8)";

        try {
          const res = await fetch("/api/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pointId: point.id })
          });

          if (res.ok) {
            const data = await res.json();

            // שינוי האייקון
            if (img) {
                img.src = data.saved ? "/icons/ui/plant/active.png" : "/icons/ui/plant/default.png";
                img.style.transform = "scale(1)";
            }

            // 👈 עדכון המונה בלייב על המסך בהתאם לתשובת השרת
            if (data.saved) {
                currentSavedCount += 1; // אם נוסף לשמורים, מעלים ב-1
            } else {
                currentSavedCount -= 1; // אם הוסר מהשמורים, מורידים ב-1
            }
            
            // מעדכנים פיזית את המלל בתוך הבלון
            if (countText) {
                countText.innerText = `${currentSavedCount} שמירות`;
            }

            // עדכון שאר האפליקציה שהייתה שמירה
            window.dispatchEvent(new Event("points-updated"));
          } else {
            if (img) img.style.transform = "scale(1)";
            alert("צריך להתחבר כדי לשמור נקודות");
          }
        } catch (err) {
          console.error("Failed to toggle save point:", err);
          if (img) img.style.transform = "scale(1)";
        }
      };
    }

    // ספירת קליקים על האתר
    const linkBtn = container.querySelector(".point-website-link") as HTMLAnchorElement;
    if (linkBtn) {
      linkBtn.onclick = () => {
        fetch(`/api/points/${point.id}/click`, { method: "POST" }).catch(console.error);
      };
    }

    return container;
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