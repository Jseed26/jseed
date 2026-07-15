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
  
  // 👈 רפרנס חדש שישמור את כל המרקרים שעל המפה כדי שנוכל לפתוח אותם אוטומטית מקישור
  const markersRef = useRef<{ [key: number]: L.Marker }>({});

  useEffect(() => {
    if (!map) return;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      layerRef.current?.remove();
    };
  }, [map]);

  function createPopupNode(point: Point, isSaved: boolean) {
    const container = document.createElement("div");
    container.style.width = "230px"; // הרחבתי טיפה כדי שיהיה מקום לכל הכפתורים
    container.style.fontFamily = "sans-serif";
    container.dir = "rtl";

    const display = (val: string | null | undefined) => (val && val.trim() !== "" ? val : "-");
    
    // לוחית עליונה: אייקון מימין, שם הנקודה משמאל
    const headerHtml = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
        <div style="background: rgba(0, 0, 0, 0.05); border-radius: 50%; padding: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="/icons/categories/${point.category}/active.png" alt="${point.category}" style="width: 18px; height: 18px; object-fit: contain;" />
        </div>
        <div style="font-weight: bold; font-size: 16px; color: #111; text-align: left; flex-grow: 1; margin-right: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${display(point.name)}
        </div>
      </div>
    `;

    const imageHtml = point.imageUrl
      ? `<img src="${point.imageUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />`
      : "";
    
    const plantIconSrc = isSaved 
      ? "/icons/ui/plant/active.png" 
      : "/icons/ui/plant/default.png";

    let currentSavedCount = point._count?.savedBy || 0;

    // הרכבת הבלון המלא כולל שורת הפעולות החדשה בתחתית!
    container.innerHTML = `
      ${headerHtml}
      ${imageHtml}
      
      <div style="max-height: 100px; overflow-y: auto; padding-right: 5px; font-size: 14px; color: #333;">
        <div style="margin-bottom: 6px;"><strong>תיאור:</strong> ${display(point.description)}</div>
        <div style="margin-bottom: 6px;"><strong>מיקום:</strong> ${display(point.address)}</div>
        <div style="margin-bottom: 6px;"><strong>קישור:</strong> ${point.website
        ? `<a href="${point.website}" target="_blank" class="point-website-link" data-id="${point.id}" style="color: blue;">למעבר לאתר</a>`
        : "-"
      }</div>
      </div>
      
      <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span class="saved-count-text" style="font-size: 12px; color: #888; font-weight: bold;">
          ${currentSavedCount} שמירות
        </span>
        <button class="save-point-btn" style="background: none; border: none; cursor: pointer; padding: 0; outline: none; display: flex; align-items: center; justify-content: center;">
          <img src="${plantIconSrc}" alt="Save" style="width: 28px; height: 28px; object-fit: contain; transition: transform 0.2s;" />
        </button>
      </div>

      <div style="display: flex; justify-content: space-around; margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee;">
        
        <a href="https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes" target="_blank" style="text-decoration: none; font-size: 20px;" title="נווט לשם">
          🚗
        </a>

        <a class="wa-share-btn" href="#" target="_blank" style="text-decoration: none; font-size: 20px;" title="שתף בוואטסאפ">
          💬
        </a>

        <button class="copy-link-btn" style="background: none; border: none; cursor: pointer; font-size: 20px; padding: 0;" title="העתק קישור">
          🔗
        </button>

        <button class="report-btn" style="background: none; border: none; cursor: pointer; font-size: 20px; padding: 0;" title="דווח על בעיה">
          🚩
        </button>
      </div>
    `;

    // 1. הגדרת קישורי השיתוף באופן דינמי (מבוסס על כתובת האתר האמיתית)
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/?point=${point.id}`;
    const waText = encodeURIComponent(`תראו איזה Seed מצאתי ב-JSeed! 🌱\n${shareUrl}`);
    
    const waBtn = container.querySelector(".wa-share-btn") as HTMLAnchorElement;
    if (waBtn) waBtn.href = `https://wa.me/?text=${waText}`;

    const copyBtn = container.querySelector(".copy-link-btn") as HTMLButtonElement;
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(shareUrl);
        alert("הקישור הועתק בהצלחה!");
      };
    }

    const reportBtn = container.querySelector(".report-btn") as HTMLButtonElement;
    if (reportBtn) {
      reportBtn.onclick = async () => {
        const reason = prompt("מה הבעיה בנקודה זו? (למשל: סגור, מידע שגוי, ספאם)");
        if (reason) {
          // מכין את התשתית לשליחת הדיווח לשרת
          try {
            await fetch("/api/reports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pointId: point.id, reason })
            });
            alert("תודה! הדיווח נשלח למנהלי האתר.");
          } catch (e) {
            alert("תודה! הדיווח נרשם.");
          }
        }
      };
    }

    // הוספת הפונקציונליות לכפתור השמירה (כמו שהיה)
    const btn = container.querySelector(".save-point-btn") as HTMLButtonElement;
    const countText = container.querySelector(".saved-count-text") as HTMLSpanElement;

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
            if (img) {
                img.src = data.saved ? "/icons/ui/plant/active.png" : "/icons/ui/plant/default.png";
                img.style.transform = "scale(1)";
            }
            if (data.saved) currentSavedCount += 1;
            else currentSavedCount -= 1;
            
            if (countText) countText.innerText = `${currentSavedCount} שמירות`;
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
    markersRef.current = {}; // איפוס הרפרנס לפני ציור מחדש

    const filtered = activeCategory
      ? points.filter((p) => p.category === activeCategory)
      : points;

    filtered.forEach((point) => {
      const isViewed = viewedIds.includes(point.id);
      const isSaved = savedIds.includes(point.id);

      const marker = L.marker(
        [point.latitude, point.longitude],
        { icon: createCategoryIcon(point.category, isViewed) }
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
      
      // 👈 שומרים את המרקר בתוך האובייקט שלנו כדי שנוכל לגשת אליו בהמשך
      markersRef.current[point.id] = marker;
    });

    // =========================================================
    // 👈 הקסם של הקישורים העמוקים (Deep Linking) 
    // בודק אם יש ?point=123 בשורת הכתובת ופותח אותו אוטומטית!
    // =========================================================
    const urlParams = new URLSearchParams(window.location.search);
    const pointIdFromUrl = urlParams.get("point");
    
    if (pointIdFromUrl) {
        const targetMarker = markersRef.current[Number(pointIdFromUrl)];
        const targetPoint = points.find(p => p.id === Number(pointIdFromUrl));
        
        if (targetMarker && targetPoint) {
            // ממורכז את המפה לנקודה ב-Zoom קרוב
            map.setView([targetPoint.latitude, targetPoint.longitude], 16);
            
            // פותח את הבלון עם השהיה קלה כדי לתת למפה לסיים את התזוזה
            setTimeout(() => {
                targetMarker.openPopup();
            }, 500);
        }
    }

  }, [map, points, activeCategory, viewedIds, savedIds]);
}