"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { Point } from "@/src/types/point";

type Props = {
  map: L.Map | null;
  points: Point[];
  activeCategory: Point["category"] | null;
  viewedIds: number[];
  savedIds?: number[];
  lang?: "he" | "en";
  searchQuery?: string;
};

// 🌟 זיכרון גלובלי מחוץ לריאקט! שומר על הצבע הכתום תמיד
const globalClickedPoints = new Set<number>();

// 🌟 פונקציית עזר ליצירת האייקון עם הגדלים המשתנים
function createGroupedIcon(category: string, isViewed: boolean, zoom: number, count: number) {
  const iconUrl = `/icons/categories/${category}/${isViewed ? "viewed" : "default"}.png`;

  // 🌟 מנגנון גדלים מאוזן ("שביל הזהב") 🌟
  let baseSize = 22; // זום אאוט מלא (רמת עולם) - מספיק ברור כדי לזהות את הצורה

  if (zoom >= 15) {
    baseSize = 44; // רמת רחוב (גדול ונוח ללחיצה)
  } else if (zoom >= 11) {
    baseSize = 34; // רמת עיר
  } else if (zoom >= 6) {
    baseSize = 28; // רמת מדינה
  }

  // התאמת הבועה הצהובה בהתאם לגודל האייקון
  const badgeSize = baseSize < 28 ? 18 : 22;
  const badgeFontSize = baseSize < 28 ? 11 : 13;
  const badgeOffset = baseSize < 28 ? -5 : -8;

  const badgeHtml = count > 1
    ? `<div style="position: absolute; top: ${badgeOffset}px; right: ${badgeOffset}px; background: #fbbf24; color: #000; border-radius: 50%; width: ${badgeSize}px; height: ${badgeSize}px; display: flex; align-items: center; justify-content: center; font-size: ${badgeFontSize}px; font-weight: 900; border: 2px solid #111827; box-shadow: 0 2px 5px rgba(0,0,0,0.5); z-index: 10;">${count}</div>`
    : '';

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${baseSize}px; height: ${baseSize}px; transition: all 0.3s ease-out;">
        <img src="${iconUrl}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.6));" />
        ${badgeHtml}
      </div>
    `,
    className: "",
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize / 2, baseSize],
    // 🌟 שינוי חשוב: החלונית תמיד תעגון לחלק התחתון של האייקון!
    popupAnchor: [0, 5]
  });
}

export function useMapMarkers({ map, points, activeCategory, viewedIds = [], savedIds = [], lang = "he", searchQuery = "" }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<{ [key: number]: L.Marker }>({});

  // 🌟 הזרקת CSS שהופך את כל החלוניות להיפתח תמיד כלפי מטה 🌟
  useEffect(() => {
    const styleId = "jseed-popup-styles-down";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .custom-popup-down {
          bottom: auto !important;
          top: 0 !important;
          margin-bottom: 0 !important;
          margin-top: 10px !important;
        }
        .custom-popup-down .leaflet-popup-tip-container {
          top: -19px !important;
          bottom: auto !important;
          transform: rotate(180deg) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!map) return;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      layerRef.current?.remove();
    };
  }, [map]);

  function createPopupNode(point: Point, isSaved: boolean, mapInstance: L.Map) {
    const container = document.createElement("div");

    // 🌟 המידות החכמות: מזהות אם זה טלפון ומתאימות את הכל!
    const isMobile = window.innerWidth < 450;
    const expandedWidth = isMobile ? "320px" : "400px";
    const imgHeight = isMobile ? "180px" : "240px"; // תמונה נמוכה יותר בטלפון
    const textMaxHeight = isMobile ? "200px" : "350px"; // פחות גלילה ריקה בטלפון

    container.style.width = expandedWidth;
    container.style.fontFamily = "sans-serif";

    const isHe = lang === "he";
    container.dir = isHe ? "rtl" : "ltr";

    const displayName = isHe ? point.name : (point.name_en || point.name);
    const displayDesc = isHe ? point.description : (point.description_en || point.description);

    const t = {
      desc: isHe ? "תיאור:" : "Description:",
      loc: isHe ? "מיקום:" : "Location:",
      link: isHe ? "קישור:" : "Website:",
      visit: isHe ? "למעבר לאתר" : "Visit Website",
      saves: isHe ? "שמירות" : "Saves",
      nav: isHe ? "נווט לשם" : "Navigate",
      shareTip: isHe ? "שתף בוואטסאפ" : "Share on WhatsApp",
      copyTip: isHe ? "העתק קישור" : "Copy Link",
      reportTip: isHe ? "דווח על בעיה" : "Report Issue",
      copiedMsg: isHe ? "הקישור הועתק בהצלחה!" : "Link copied successfully!",
      reportMsg: isHe ? "מה הבעיה בגרעין זה? (למשל: סגור, מידע שגוי, ספאם)" : "What is the issue? (e.g., Closed, Wrong info, Spam)",
      reportSuccess: isHe ? "תודה! הדיווח נשלח למנהלי האתר." : "Thank you! The report has been sent.",
      loginReq: isHe ? "צריך להתחבר כדי לשמור נקודות" : "Please log in to save seeds",
      waText: isHe ? "תראו איזה Seed מצאתי ב-JSeed! 🌱" : "Check out this Seed I found on JSeed! 🌱",
      participants: isHe ? "משתתפים" : "Participants"
    };

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    const display = (val: string | null | undefined) => (val && val.trim() !== "" ? val : "-");

    const isChai = point.category === "chai";

    const headerHtml = `
      <div style="position: relative; padding-top: 10px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #374151;">
        
        <div style="display: flex; align-items: flex-start; gap: 8px; padding: ${isHe ? '0 15px 0 20px' : '0 20px 0 15px'};">
          <div style="background: rgba(255, 255, 255, 0.1); border-radius: 50%; padding: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
            <img src="/icons/categories/${point.category}/active.png" alt="${point.category}" style="width: 18px; height: 18px; object-fit: contain;" />
          </div>
          
          <div class="point-title" style="font-weight: bold; font-size: 16px; color: #f9fafb; text-align: ${isHe ? 'right' : 'left'}; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.3; margin-top: 5px;">
            ${display(displayName)}
          </div>

          ${isChai ? `
          <button class="add-chai-btn" style="background: rgba(251,191,36,0.15); border: 1px solid #fbbf24; color: #fbbf24; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-top: 3px; flex-shrink: 0; transition: all 0.2s;" title="הוסף נקודה ליוזמה זו">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>
          </button>
          ` : ''}
        </div>
      </div>
    `;

    const imagesList = point.imageUrls && point.imageUrls.length > 0
      ? point.imageUrls
      : (point.imageUrl ? [point.imageUrl] : []);

    const imagesJsonStr = JSON.stringify(imagesList).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    let imageHtml = "";

    if (imagesList.length === 1) {
      imageHtml = `<img src="${imagesList[0]}" class="map-lightbox-trigger point-image-container" data-images="${imagesJsonStr}" data-index="0" style="width: 100%; height: ${imgHeight}; object-fit: cover; border-radius: 8px; margin-bottom: 8px; cursor: pointer;" title="לחץ להגדלה" />`;
    } else if (imagesList.length > 1) {
      imageHtml = `
        <div class="point-image-container" style="position: relative; width: 100%; height: ${imgHeight}; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: #000;">
          ${imagesList.map((src, i) => `
            <img class="carousel-slide-${point.id} map-lightbox-trigger" data-images="${imagesJsonStr}" data-index="${i}" src="${src}" style="position: relative; width: 100%; height: ${imgHeight}; border-radius: 8px; position: absolute; top: 0; left: 0; display: ${i === 0 ? 'block' : 'none'}; cursor: pointer;" title="לחץ להגדלה" />
          `).join('')}
          <button class="carousel-prev-${point.id}" style="position: absolute; ${isHe ? 'left' : 'right'}: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">${isHe ? '❮' : '❯'}</button>
          <button class="carousel-next-${point.id}" style="position: absolute; ${isHe ? 'right' : 'left'}: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">${isHe ? '❯' : '❮'}</button>
          <div style="position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; z-index: 10; flex-direction: ${isHe ? 'row-reverse' : 'row'};">
            ${imagesList.map((_, i) => `
              <div class="carousel-dot-${point.id}" data-index="${i}" style="width: 6px; height: 6px; border-radius: 50%; background: ${i === 0 ? '#ffffff' : 'rgba(255,255,255,0.4)'}; cursor: pointer;"></div>
            `).join('')}
          </div>
        </div>
      `;
    }

    const plantIconSrc = isSaved ? "/icons/ui/plant/active.png" : "/icons/ui/plant/default.png";
    let currentSavedCount = point._count?.savedBy || 0;

    const participantsCount = isChai ? points.filter(p => p.category === "chai" && p.name === point.name).length : 0;

    container.innerHTML = `
      ${headerHtml}
      ${imageHtml}
      
      <div class="point-desc-container" style="max-height: ${textMaxHeight}; overflow-y: auto; padding-${isHe ? 'right' : 'left'}: 5px; font-size: 14px; color: #d1d5db;">
        <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">${t.desc}</strong> ${display(displayDesc)}</div>
        <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">${t.loc}</strong> ${display(point.address)}</div>
        <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">${t.link}</strong> ${point.website
        ? `<a href="${point.website}" target="_blank" class="point-website-link" data-id="${point.id}" style="color: #fbbf24; text-decoration: none;">${t.visit}</a>`
        : "-"
      }</div>
      </div>
      
      <div style="margin-top: 8px; border-top: 1px solid #374151; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <span class="saved-count-text" style="font-size: 12px; color: #9ca3af; font-weight: bold;">
            ${currentSavedCount} ${t.saves}
          </span>
          ${isChai ? `
          <span style="font-size: 12px; color: #fbbf24; font-weight: bold;">
            🤝 ${participantsCount} ${t.participants}
          </span>
          ` : ''}
        </div>
        <button class="save-point-btn" style="background: none; border: none; cursor: pointer; padding: 0; outline: none; display: flex; align-items: center; justify-content: center;">
          <img src="${plantIconSrc}" alt="Save" style="width: 28px; height: 28px; object-fit: contain; transition: transform 0.2s;" />
        </button>
      </div>

      <div style="display: flex; justify-content: space-around; margin-top: 12px; padding-top: 10px; border-top: 1px solid #374151;">
       <a href="https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes" target="_blank" style="text-decoration: none; display: flex; align-items: center;" title="${t.nav}">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#05c8f6" viewBox="0 0 16 16"><path d="M4 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.777 5.093c.123-.38.272-.733.447-1.053C2.81 2.915 3.86 2 5.25 2h5.5c1.39 0 2.44.915 3.026 2.04.175.32.324.672.447 1.053C14.743 6.134 15 7.155 15 8.125V11a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H4v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8.125c0-.97.257-1.99.777-3.032ZM3.7 5.021a1.5 1.5 0 0 0-1.187 1.5V7h10.974v-.479a1.5 1.5 0 0 0-1.187-1.5l-4.22-.844a1.5 1.5 0 0 0-.86 0l-4.22.844Z"/></svg>
        </a>
        <a class="wa-share-btn" href="#" target="_blank" style="text-decoration: none; font-size: 20px;" title="${t.shareTip}">💬</a>
        <button class="copy-link-btn" style="background: none; border: none; cursor: pointer; font-size: 20px; padding: 0;" title="${t.copyTip}">🔗</button>
        <button class="report-btn" style="background: none; border: none; cursor: pointer; font-size: 20px; padding: 0;" title="${t.reportTip}">🚩</button>
      </div>
    `;


    const lightBoxTriggers = container.querySelectorAll(".map-lightbox-trigger");
    lightBoxTriggers.forEach((trigger) => {
      trigger.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const imgsJson = target.getAttribute("data-images") || "[]";
        const idx = parseInt(target.getAttribute("data-index") || "0");

        try {
          const imgsArray = JSON.parse(imgsJson);
          window.dispatchEvent(new CustomEvent("open-map-lightbox", {
            detail: { images: imgsArray, index: idx }
          }));
        } catch (err) { }
      });
    });

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

      if (btnPrev) btnPrev.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : imagesList.length - 1;
        showSlide(currentIndex);
      };

      if (btnNext) btnNext.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentIndex = (currentIndex < imagesList.length - 1) ? currentIndex + 1 : 0;
        showSlide(currentIndex);
      };

      dots.forEach(dot => {
        dot.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const target = e.target as HTMLElement;
          currentIndex = parseInt(target.getAttribute("data-index") || "0");
          showSlide(currentIndex);
        };
      });
    }

    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/?point=${point.id}`;
    const waTextUrl = encodeURIComponent(`${t.waText}\n${shareUrl}`);

    const waBtn = container.querySelector(".wa-share-btn") as HTMLAnchorElement;
    if (waBtn) waBtn.href = `https://wa.me/?text=${waTextUrl}`;

    const copyBtn = container.querySelector(".copy-link-btn") as HTMLButtonElement;
    if (copyBtn) {
      copyBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(shareUrl);
        alert(t.copiedMsg);
      };
    }

    const reportBtn = container.querySelector(".report-btn") as HTMLButtonElement;
    if (reportBtn) {
      reportBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const reason = prompt(t.reportMsg);
        if (reason) {
          try {
            await fetch("/api/reports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pointId: point.id, reason })
            });
            alert(t.reportSuccess);
          } catch (err) {
            alert(t.reportSuccess);
          }
        }
      };
    }

    const btn = container.querySelector(".save-point-btn") as HTMLButtonElement;
    const countText = container.querySelector(".saved-count-text") as HTMLSpanElement;

    if (btn) {
      btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
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

            if (countText) countText.innerText = `${currentSavedCount} ${t.saves}`;
          } else {
            if (img) img.style.transform = "scale(1)";
            alert(t.loginReq);
          }
        } catch (err) {
          console.error("Failed to toggle save point:", err);
          if (img) img.style.transform = "scale(1)";
        }
      };
    }

    const linkBtn = container.querySelector(".point-website-link") as HTMLAnchorElement;
    if (linkBtn) {
      linkBtn.onclick = (e) => {
        fetch(`/api/points/${point.id}/click`, { method: "POST" }).catch(console.error);
      };
    }

    const addChaiBtn = container.querySelector(".add-chai-btn") as HTMLButtonElement;
    if (addChaiBtn) {
      addChaiBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("open-direct-add-form", {
          detail: {
            name: point.name,
            category: "chai",
            lat: point.latitude,
            lng: point.longitude
          }
        }));
      };
    }

    return container;
  }

  useEffect(() => {
    if (!map || !layerRef.current) return;

    layerRef.current.clearLayers();
    markersRef.current = {};

    const filtered = points.filter((p) => {
      return activeCategory ? p.category === activeCategory : true;
    });

    const groupedByLocation: Record<string, Record<string, Point[]>> = {};

    filtered.forEach(point => {
      const lat = Number(point.latitude).toFixed(4);
      const lng = Number(point.longitude).toFixed(4);
      const locKey = `${lat},${lng}`;

      if (!groupedByLocation[locKey]) {
        groupedByLocation[locKey] = {};
      }
      if (!groupedByLocation[locKey][point.category]) {
        groupedByLocation[locKey][point.category] = [];
      }
      groupedByLocation[locKey][point.category].push(point);
    });

    Object.entries(groupedByLocation).forEach(([locKey, categoriesGroup]) => {
      const [centerLatStr, centerLngStr] = locKey.split(',');
      const centerLat = parseFloat(centerLatStr);
      const centerLng = parseFloat(centerLngStr);

      const categoriesList = Object.keys(categoriesGroup);
      const numCategories = categoriesList.length;

      categoriesList.forEach((category, index) => {
        const pointsInCat = categoriesGroup[category];
        const count = pointsInCat.length;

        let finalLat = centerLat;
        let finalLng = centerLng;

        if (numCategories > 1) {
          const angle = (index * 2 * Math.PI) / numCategories;
          const radius = 0.00015;
          finalLat += radius * Math.cos(angle);
          finalLng += radius * Math.sin(angle);
        }

        const isAnyViewed = pointsInCat.some(p =>
          viewedIds.map(Number).includes(Number(p.id)) || globalClickedPoints.has(Number(p.id))
        );

        const marker = L.marker(
          [finalLat, finalLng],
          { icon: createGroupedIcon(category, isAnyViewed, map.getZoom(), count) }
        );

        const popupContent = document.createElement("div");

        if (count === 1) {
          const singlePoint = pointsInCat[0];
          const isSaved = savedIds.includes(singlePoint.id);
          popupContent.appendChild(createPopupNode(singlePoint, isSaved, map));
        } else {
          let currentIndex = 0;

          const renderCurrentPoint = () => {
            popupContent.innerHTML = "";

            const currentPoint = pointsInCat[currentIndex];
            const pId = Number(currentPoint.id);
            const isSaved = savedIds.includes(currentPoint.id);

            if (!globalClickedPoints.has(pId)) {
              globalClickedPoints.add(pId);
              fetch("/api/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pointId: pId }),
              }).catch(console.error);

              marker.setIcon(createGroupedIcon(category, true, map.getZoom(), count));
            }

            const navBar = document.createElement("div");
            navBar.style.display = "flex";
            navBar.style.justifyContent = "space-between";
            navBar.style.alignItems = "center";
            navBar.style.backgroundColor = "rgba(251, 191, 36, 0.15)";
            navBar.style.border = "1px solid rgba(251, 191, 36, 0.4)";
            navBar.style.borderRadius = "12px";
            navBar.style.padding = "6px 10px";
            navBar.style.marginBottom = "10px";
            navBar.dir = lang === "he" ? "rtl" : "ltr";

            const createBtn = (html: string, onClick: () => void) => {
              const btn = document.createElement("button");
              btn.innerHTML = html;
              btn.style.background = "rgba(251, 191, 36, 0.2)";
              btn.style.border = "1px solid #fbbf24";
              btn.style.color = "#fbbf24";
              btn.style.borderRadius = "50%";
              btn.style.width = "26px";
              btn.style.height = "26px";
              btn.style.display = "flex";
              btn.style.alignItems = "center";
              btn.style.justifyContent = "center";
              btn.style.cursor = "pointer";
              btn.style.transition = "background 0.2s";
              btn.onmouseover = () => btn.style.background = "rgba(251, 191, 36, 0.4)";
              btn.onmouseout = () => btn.style.background = "rgba(251, 191, 36, 0.2)";
              btn.onclick = (e) => { e.stopPropagation(); onClick(); };
              return btn;
            };

            const prevBtn = createBtn(lang === "he" ? "❯" : "❮", () => {
              currentIndex = (currentIndex > 0) ? currentIndex - 1 : count - 1;
              renderCurrentPoint();
            });

            const nextBtn = createBtn(lang === "he" ? "❮" : "❯", () => {
              currentIndex = (currentIndex < count - 1) ? currentIndex + 1 : 0;
              renderCurrentPoint();
            });

            const label = document.createElement("span");
            label.innerText = lang === "he" ? `נקודה ${currentIndex + 1} מתוך ${count}` : `Point ${currentIndex + 1} of ${count}`;
            label.style.fontSize = "12px";
            label.style.fontWeight = "bold";
            label.style.color = "#fbbf24";

            navBar.appendChild(prevBtn);
            navBar.appendChild(label);
            navBar.appendChild(nextBtn);

            popupContent.appendChild(navBar);
            popupContent.appendChild(createPopupNode(currentPoint, isSaved, map));
          };

          renderCurrentPoint();
        }

        const isMobile = window.innerWidth < 450;
        const popupWidth = isMobile ? 320 : 400;

        // 🌟 החלונית תמיד מקבלת את הקלאס שיפתח אותה למטה, ו-autoPan מכובה
        marker.bindPopup(popupContent, {
          closeButton: true,
          className: "custom-popup custom-popup-down",
          autoPan: false,
          maxWidth: 500,
          minWidth: popupWidth
        });

        marker.on("click", () => {
          // 🌟 מחקנו את setMaxBounds(null)! המפה נשארת תמיד בתוך הגבולות שלה.
          const currentZoom = map.getZoom();

          if (count === 1) {
            const pId = Number(pointsInCat[0].id);
            if (!globalClickedPoints.has(pId)) {
              globalClickedPoints.add(pId);
              fetch("/api/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pointId: pId }),
              }).catch(console.error);
            }
            marker.setIcon(createGroupedIcon(category, true, currentZoom, count));
          } else {
            marker.setIcon(createGroupedIcon(category, true, currentZoom, count));
          }

          marker.openPopup();

          // 🌟 מירכוז חכם: מזיזים את המפה כלפי מטה, כדי שהגרעין יעלה למעלה והחלונית תהיה במרכז!
          setTimeout(() => {
            const px = map.project(marker.getLatLng());
            const shiftY = window.innerWidth < 450 ? 150 : 180;
            px.y += shiftY;
            map.panTo(map.unproject(px), { animate: true });
          }, 50);
        });

        // 🌟 מחקנו לגמרי את האירוע popupclose שעשה בעיות עם הגבולות

        layerRef.current?.addLayer(marker);

        pointsInCat.forEach(p => {
          markersRef.current[p.id] = marker;
        });
      });
    });

    const urlParams = new URLSearchParams(window.location.search);
    const pointIdFromUrl = urlParams.get("point");

    if (pointIdFromUrl) {
      const targetMarker = markersRef.current[Number(pointIdFromUrl)];
      const targetPoint = points.find(p => p.id === Number(pointIdFromUrl));

      if (targetMarker && targetPoint) {
        map.setView([targetPoint.latitude, targetPoint.longitude], 16);
        setTimeout(() => {
          targetMarker.openPopup();
          
          // 🌟 מירכוז חכם גם כשהמשתמש מגיע מקישור
          const px = map.project(targetMarker.getLatLng());
          const shiftY = window.innerWidth < 450 ? 150 : 180;
          px.y += shiftY;
          map.panTo(map.unproject(px), { animate: true });
        }, 500);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    const handleZoomEnd = () => {
      const currentZoom = map.getZoom();

      Object.values(groupedByLocation).forEach(categoriesGroup => {
        Object.entries(categoriesGroup).forEach(([category, pointsInCat]) => {
          const count = pointsInCat.length;
          const firstId = pointsInCat[0].id;
          const marker = markersRef.current[firstId];
          if (marker) {
            const isAnyViewed = pointsInCat.some(p =>
              viewedIds.map(Number).includes(Number(p.id)) || globalClickedPoints.has(Number(p.id))
            );
            marker.setIcon(createGroupedIcon(category, isAnyViewed, currentZoom, count));
          }
        });
      });
    };

    map.on("zoomend", handleZoomEnd);

    return () => {
      map.off("zoomend", handleZoomEnd);
    };

  }, [map, points, activeCategory, viewedIds, savedIds, lang, searchQuery]);
}