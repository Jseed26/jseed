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

  // 👈 הזיכרון המקומי החדש שזוכר מה לחצנו עכשיו
  const clickedLocallyRef = useRef<Set<number>>(new Set());

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
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #374151;">
        <div style="background: rgba(255, 255, 255, 0.1); border-radius: 50%; padding: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="/icons/categories/${point.category}/active.png" alt="${point.category}" style="width: 18px; height: 18px; object-fit: contain;" />
        </div>
        <div style="font-weight: bold; font-size: 16px; color: #f9fafb; text-align: left; flex-grow: 1; margin-right: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${display(point.name)}
        </div>
      </div>
    `;

   // 👈 1. אוספים את התמונות: אם יש מערך תמונות נשתמש בו, ואם יש תמונה בודדת ישנה - נשים אותה במערך
    const imagesList = point.imageUrls && point.imageUrls.length > 0 
      ? point.imageUrls 
      : (point.imageUrl ? [point.imageUrl] : []);

    let imageHtml = "";
    
    // 👈 2. בניית ה-HTML של הקרוסלה (רק אם יש תמונות)
    if (imagesList.length === 1) {
      // אם יש רק תמונה אחת - מציגים אותה רגיל
      imageHtml = `<img src="${imagesList[0]}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />`;
    } else if (imagesList.length > 1) {
      // אם יש יותר מאחת - בונים קרוסלה!
      imageHtml = `
        <div style="position: relative; width: 100%; height: 120px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: #000;">
          
          <!-- התמונות -->
          ${imagesList.map((src, i) => `
            <img class="carousel-slide-${point.id}" src="${src}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; display: ${i === 0 ? 'block' : 'none'};" />
          `).join('')}

          <!-- חיצים (ימין ושמאל) -->
          <button class="carousel-prev-${point.id}" style="position: absolute; left: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">❮</button>
          
          <button class="carousel-next-${point.id}" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">❯</button>

          <!-- נקודות דפדוף למטה -->
          <div style="position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; z-index: 10; flex-direction: row-reverse;">
            ${imagesList.map((_, i) => `
              <div class="carousel-dot-${point.id}" data-index="${i}" style="width: 6px; height: 6px; border-radius: 50%; background: ${i === 0 ? '#ffffff' : 'rgba(255,255,255,0.4)'}; cursor: pointer; transition: 0.3s;"></div>
            `).join('')}
          </div>
        </div>
      `;
    }

    const plantIconSrc = isSaved
      ? "/icons/ui/plant/active.png"
      : "/icons/ui/plant/default.png";

    let currentSavedCount = point._count?.savedBy || 0;

    // הרכבת הבלון המלא כולל צבעים מותאמים לכהה
    container.innerHTML = `
      ${headerHtml}
      ${imageHtml}
      
      <div style="max-height: 100px; overflow-y: auto; padding-right: 5px; font-size: 14px; color: #d1d5db;">
        <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">תיאור:</strong> ${display(point.description)}</div>
        <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">מיקום:</strong> ${display(point.address)}</div>
        <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">קישור:</strong> ${point.website
        ? `<a href="${point.website}" target="_blank" class="point-website-link" data-id="${point.id}" style="color: #fbbf24; text-decoration: none;">למעבר לאתר</a>`
        : "-"
      }</div>
      </div>
      
      <div style="margin-top: 8px; border-top: 1px solid #374151; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span class="saved-count-text" style="font-size: 12px; color: #9ca3af; font-weight: bold;">
          ${currentSavedCount} שמירות
        </span>
        <button class="save-point-btn" style="background: none; border: none; cursor: pointer; padding: 0; outline: none; display: flex; align-items: center; justify-content: center;">
          <img src="${plantIconSrc}" alt="Save" style="width: 28px; height: 28px; object-fit: contain; transition: transform 0.2s;" />
        </button>
      </div>

      <div style="display: flex; justify-content: space-around; margin-top: 12px; padding-top: 10px; border-top: 1px solid #374151;">
        
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

    // 👈 3. הפעלת הלוגיקה של הקרוסלה (רק אם יש יותר מתמונה אחת)
    if (imagesList.length > 1) {
      let currentIndex = 0;
      const slides = container.querySelectorAll(`.carousel-slide-${point.id}`) as NodeListOf<HTMLImageElement>;
      const dots = container.querySelectorAll(`.carousel-dot-${point.id}`) as NodeListOf<HTMLDivElement>;
      const btnPrev = container.querySelector(`.carousel-prev-${point.id}`) as HTMLButtonElement;
      const btnNext = container.querySelector(`.carousel-next-${point.id}`) as HTMLButtonElement;

      const showSlide = (index: number) => {
        slides.forEach((s, i) => s.style.display = i === index ? 'block' : 'none');
        dots.forEach((d, i) => d.style.background = i === index ? '#ffffff' : 'rgba(255,255,255,0.4)');
      };

      if (btnPrev) btnPrev.onclick = () => {
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : imagesList.length - 1;
        showSlide(currentIndex);
      };

      if (btnNext) btnNext.onclick = () => {
        currentIndex = (currentIndex < imagesList.length - 1) ? currentIndex + 1 : 0;
        showSlide(currentIndex);
      };

      dots.forEach(dot => {
        dot.onclick = (e) => {
          const target = e.target as HTMLElement;
          currentIndex = parseInt(target.getAttribute("data-index") || "0");
          showSlide(currentIndex);
        };
      });
    }

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
        const reason = prompt("מה הבעיה בגרעין זה? (למשל: סגור, מידע שגוי, ספאם)");
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
      // מוודאים שגם בציור הראשוני הנקודה תהיה כתומה אם לחצנו עליה הרגע
      const isViewed = viewedIds.includes(point.id) || clickedLocallyRef.current.has(point.id);
      const isSaved = savedIds.includes(point.id);

      const marker = L.marker(
        [point.latitude, point.longitude],
        // 👈 הוספנו פה את map.getZoom() בסוף
        { icon: createCategoryIcon(point.category, isViewed, map.getZoom()) }
      );

      // 1. הגדרת הבועה (עם מנגנון הזזה אוטומטי חכם)
      marker.bindPopup(createPopupNode(point, isSaved), {
        closeButton: true,
        className: "custom-popup",
        autoPan: true,
        autoPanPaddingTopLeft: [0, 150], // שומר מרחק משורת החיפוש העליונה
        autoPanPaddingBottomRight: [0, 20]
      });

      // 2. אירוע הלחיצה (פתיחה)
      marker.on("click", (e) => {
        map.setMaxBounds(null as any);
        const currentZoom = map.getZoom();

        // 🌟 שומרים מיד בזיכרון המקומי שלחצנו על הנקודה הזו!
        clickedLocallyRef.current.add(point.id);

        marker.setIcon(createCategoryIcon(point.category, true, currentZoom));
        marker.openPopup();

        if (point.id) {
          fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pointId: point.id }),
          }).catch((err) => console.error("Failed to save history:", err));
        }
      });

      // 3. אירוע סגירת הבועה
      marker.on("popupclose", () => {
        const worldBounds = L.latLngBounds([-90, -180], [90, 180]);
        map.setMaxBounds(worldBounds);
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

        // 👈 מנקה את ה-?point= מהכתובת כדי שלא יתקע את המפה בהמשך
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    // =========================================================
    // 👈 האזנה לשינויי זום ורענון גודל האייקונים
    // =========================================================
    const handleZoomEnd = () => {
      const currentZoom = map.getZoom();

      filtered.forEach((point) => {
        const marker = markersRef.current[point.id];
        if (marker) {
          // 🌟 התיקון כאן: שימוש בזיכרון המקומי בזמן זום
          const isViewed = viewedIds.includes(point.id) || clickedLocallyRef.current.has(point.id);

          marker.setIcon(createCategoryIcon(point.category, isViewed, currentZoom));
        }
      });
    };

    // אומרים למפה להפעיל את הפונקציה בכל פעם שהזום מסתיים
    map.on("zoomend", handleZoomEnd);

    // ניקוי המאזין כשהקומפוננטה יוצאת
    return () => {
      map.off("zoomend", handleZoomEnd);
    };

  }, [map, points, activeCategory, viewedIds, savedIds]);
}