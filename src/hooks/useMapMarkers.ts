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

// 🌟 זיכרון גלובלי מחוץ לריאקט! ככה אף רינדור מחדש של המפה לא יאפס לנו את הכתום
const globalClickedPoints = new Set<number>();

function createGroupedIcon(category: string, isViewed: boolean, zoom: number, count: number) {
  const iconUrl = `/icons/categories/${category}/${isViewed ? "viewed" : "default"}.png`;
  const baseSize = zoom > 12 ? 42 : 32;

  const badgeHtml = count > 1
    ? `<div style="position: absolute; top: -8px; right: -8px; background: #fbbf24; color: #000; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; border: 2px solid #111827; box-shadow: 0 2px 5px rgba(0,0,0,0.5); z-index: 10;">${count}</div>`
    : '';

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${baseSize}px; height: ${baseSize}px; transition: all 0.2s;">
        <img src="${iconUrl}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.6));" />
        ${badgeHtml}
      </div>
    `,
    className: "", 
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize / 2, baseSize],
    popupAnchor: [0, -baseSize + 5]
  });
}

export function useMapMarkers({ map, points, activeCategory, viewedIds = [], savedIds = [], lang = "he", searchQuery = "" }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<{ [key: number]: L.Marker }>({});

  useEffect(() => {
    if (!map) return;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      layerRef.current?.remove();
    };
  }, [map]);

  function createPopupNode(point: Point, isSaved: boolean, mapInstance: L.Map) {
    const container = document.createElement("div");
    container.style.width = "230px";
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
      expand: isHe ? "הגדל חלונית" : "Expand",
      collapse: isHe ? "הקטן חלונית" : "Collapse",
      participants: isHe ? "משתתפים" : "Participants"
    };

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    const display = (val: string | null | undefined) => (val && val.trim() !== "" ? val : "-");

    const expandSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/></svg>`;
    const collapseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M5.5 5a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 1 0v4A1.5 1.5 0 0 1 5.5 6h-4a.5.5 0 0 1 0-1h4zM10.5 5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 0-1 0v4A1.5 1.5 0 0 0 10.5 6h4a.5.5 0 0 0 0-1h-4zM5.5 11a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 1 0v-4A1.5 1.5 0 0 0 5.5 10h-4a.5.5 0 0 0 0 1h4zm5 0a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 10.5 10h4a.5.5 0 0 1 0 1h-4z"/></svg>`;

    const isChai = point.category === "chai";

    const headerHtml = `
      <div style="position: relative; padding-top: 10px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #374151;">
        
        <div style="display: flex; align-items: flex-start; gap: 8px; padding: ${isHe ? '0 15px 0 20px' : '0 20px 0 15px'};">
          <div style="background: rgba(255, 255, 255, 0.1); border-radius: 50%; padding: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
            <img src="/icons/categories/${point.category}/active.png" alt="${point.category}" style="width: 18px; height: 18px; object-fit: contain;" />
          </div>
          
          <div class="point-title" style="font-weight: bold; font-size: 16px; color: #f9fafb; text-align: ${isHe ? 'right' : 'left'}; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; margin-top: 5px;">
            ${display(displayName)}
          </div>

          ${isChai ? `
          <button class="add-chai-btn" style="background: rgba(251,191,36,0.15); border: 1px solid #fbbf24; color: #fbbf24; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-top: 3px; flex-shrink: 0; transition: all 0.2s;" title="הוסף נקודה ליוזמה זו">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>
          </button>
          ` : ''}
        </div>
        
        <button class="expand-point-btn" style="position: absolute; top: -10px; left: -20px; width: 30px; height: 30px; background: transparent; border: none; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.2s; z-index: 10;" title="${t.expand}">
          ${expandSvg}
        </button>
      </div>
    `;

    const imagesList = point.imageUrls && point.imageUrls.length > 0
      ? point.imageUrls
      : (point.imageUrl ? [point.imageUrl] : []);

    const imagesJsonStr = JSON.stringify(imagesList).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    let imageHtml = "";

    if (imagesList.length === 1) {
      imageHtml = `<img src="${imagesList[0]}" class="map-lightbox-trigger point-image-container" data-images="${imagesJsonStr}" data-index="0" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; cursor: pointer;" title="לחץ להגדלה" />`;
    } else if (imagesList.length > 1) {
      imageHtml = `
        <div class="point-image-container" style="position: relative; width: 100%; height: 120px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: #000;">
          ${imagesList.map((src, i) => `
            <img class="carousel-slide-${point.id} map-lightbox-trigger" data-images="${imagesJsonStr}" data-index="${i}" src="${src}" style="width: 100\%; height: 100\%; object-fit: cover; position: absolute; top: 0; left: 0; display: ${i === 0 ? 'block' : 'none'}; cursor: pointer;" title="לחץ להגדלה" />
          `).join('')}
          <button class="carousel-prev-${point.id}" style="position: absolute; ${isHe ? 'left' : 'right'}: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">${isHe ? '❮' : '❯'}</button>
          <button class="carousel-next-${point.id}" style="position: absolute; ${isHe ? 'right' : 'left'}: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">${isHe ? '❯' : '❮'}</button>
          <div style="position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; z-index: 10; flex-direction: ${isHe ? 'row-reverse' : 'row'};">
            ${imagesList.map((_, i) => `
              <div class="carousel-dot-${point.id}" data-index="${i}" style="width: 6px; height: 6px; border-radius: 50\%; background: ${i === 0 ? '#ffffff' : 'rgba(255,255,255,0.4)'}; cursor: pointer;"></div>
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
      
      <div class="point-desc-container" style="max-height: 100px; overflow-y: auto; padding-${isHe ? 'right' : 'left'}: 5px; font-size: 14px; color: #d1d5db;">
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
            🤝 ${participantsCount}${t.participants}
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

    let isExpanded = false;
    const expandBtn = container.querySelector(".expand-point-btn") as HTMLButtonElement;

    if (expandBtn) {
      expandBtn.onmouseover = () => expandBtn.style.color = "#FFD700";
      expandBtn.onmouseout = () => expandBtn.style.color = "#9ca3af";

      expandBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        isExpanded = !isExpanded;

        const expandedWidth = window.innerWidth < 450 ? "320px" : "400px";
        const newWidth = isExpanded ? expandedWidth : "230px";

        container.style.width = newWidth;

        const leafletContent = container.closest('.leaflet-popup-content') as HTMLElement;
        if (leafletContent) {
          leafletContent.style.width = newWidth;
        }

        const title = container.querySelector(".point-title") as HTMLElement;
        if (title) title.style.whiteSpace = isExpanded ? "normal" : "nowrap";

        const imgContainer = container.querySelector(".point-image-container") as HTMLElement;
        if (imgContainer) imgContainer.style.height = isExpanded ? "240px" : "120px";

        const descContainer = container.querySelector(".point-desc-container") as HTMLElement;
        if (descContainer) descContainer.style.maxHeight = isExpanded ? "350px" : "100px";

        expandBtn.innerHTML = isExpanded ? collapseSvg : expandSvg;
        expandBtn.title = isExpanded ? t.collapse : t.expand;

        mapInstance.eachLayer((layer: any) => {
          if (layer instanceof L.Marker && layer.getLatLng().lat === point.latitude && layer.getLatLng().lng === point.longitude) {
            const popup = layer.getPopup();
            if (popup) {
              popup.update();
              const targetLatLng = layer.getLatLng();
              const px = mapInstance.project(targetLatLng);
              px.y -= isExpanded ? 220 : 100;
              mapInstance.panTo(mapInstance.unproject(px), { animate: true });
            }
          }
        });
      };
    }

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
        e.preventDefault(); e.stopPropagation();
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : imagesList.length - 1;
        showSlide(currentIndex);
      };

      if (btnNext) btnNext.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        currentIndex = (currentIndex < imagesList.length - 1) ? currentIndex + 1 : 0;
        showSlide(currentIndex);
      };

      dots.forEach(dot => {
        dot.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
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
        e.preventDefault(); e.stopPropagation();
        navigator.clipboard.writeText(shareUrl);
        alert(t.copiedMsg);
      };
    }

    const reportBtn = container.querySelector(".report-btn") as HTMLButtonElement;
    if (reportBtn) {
      reportBtn.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
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
        e.preventDefault(); e.stopPropagation();
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
            window.dispatchEvent(new Event("points-updated"));
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
        e.preventDefault(); e.stopPropagation();
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

        // 🌟 בדיקה האם לנקודה יש 'נצפה' מתוך המערך או מהזיכרון
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
          let viewState: 'list' | 'detail' = 'list';
          let selectedPointIndex = 0;

          const renderPopupState = () => {
            popupContent.innerHTML = ""; 

            if (viewState === 'list') {
              const header = document.createElement("div");
              header.innerHTML = `
                <div style="font-weight: bold; padding-bottom: 8px; border-bottom: 1px solid #374151; margin-bottom: 8px; color: #fbbf24; text-align: center;">
                  ${count} ${lang === "he" ? "נקודות במיקום זה" : "Points at this location"}
                </div>
              `;
              popupContent.appendChild(header);

              const listContainer = document.createElement("div");
              listContainer.style.maxHeight = "250px";
              listContainer.style.overflowY = "auto";
              listContainer.style.paddingRight = "5px";
              listContainer.className = "custom-scrollbar";
              listContainer.dir = lang === "he" ? "rtl" : "ltr";

              pointsInCat.forEach((p, idx) => {
                const row = document.createElement("div");
                row.style.padding = "8px 0";
                row.style.borderBottom = "1px solid #374151";
                row.style.cursor = "pointer";
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.gap = "10px";
                row.style.transition = "background 0.2s";
                row.onmouseover = () => row.style.backgroundColor = "rgba(255,255,255,0.05)";
                row.onmouseout = () => row.style.backgroundColor = "transparent";

                // 🌟 בדיקה פרטנית על כל יוזמה - האם היא נצפתה או לא?
                const isPointViewed = viewedIds.map(Number).includes(Number(p.id)) || globalClickedPoints.has(Number(p.id));
                
                row.onclick = (e) => {
                  e.stopPropagation();
                  viewState = 'detail';
                  selectedPointIndex = idx;
                  
                  const currentPoint = pointsInCat[idx];
                  const pId = Number(currentPoint.id);
                  
                  globalClickedPoints.add(pId);
                  
                  fetch("/api/history", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pointId: pId }),
                  })
                  .then(() => {
                      window.dispatchEvent(new Event("points-updated"));
                  })
                  .catch(console.error);

                  marker.setIcon(createGroupedIcon(category, true, map.getZoom(), count));

                  renderPopupState();
                };

                const imgUrl = (p.imageUrls && p.imageUrls.length > 0) ? p.imageUrls[0] : (p.imageUrl || `/icons/categories/${category}/default.png`);
                const pName = lang === "he" ? p.name : (p.name_en || p.name);
                const arrowIcon = lang === "he" ? "❮" : "❯";
                const viewedText = lang === "he" ? "✓ נצפה" : "✓ Viewed";

                // 🌟 פה אנחנו שמים את החיווי הוויזואלי (צבע כתום + המילה "נצפה")
                row.innerHTML = `
                  <img src="${imgUrl}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover; background: rgba(255,255,255,0.1); flex-shrink: 0; opacity: ${isPointViewed ? '0.7' : '1'};" />
                  <div style="flex: 1; overflow: hidden;">
                    <div style="font-weight: bold; font-size: 13px; color: ${isPointViewed ? '#fbbf24' : '#fff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pName}</div>
                    <div style="font-size: 11px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.address || ''}</div>
                  </div>
                  <div style="color: ${isPointViewed ? '#fbbf24' : '#9ca3af'}; font-size: 11px; margin-left: 5px; margin-right: 5px; display: flex; align-items: center; gap: 6px;">
                    ${isPointViewed ? `<span style="font-weight: bold;">${viewedText}</span>` : ''}
                    <span style="font-size: 14px;">${arrowIcon}</span>
                  </div>
                `;
                listContainer.appendChild(row);
              });
              
              popupContent.appendChild(listContainer);

            } else {
              const currentPoint = pointsInCat[selectedPointIndex];
              const isSaved = savedIds.includes(currentPoint.id);

              const backNav = document.createElement("div");
              backNav.style.paddingBottom = "10px";
              backNav.style.marginBottom = "5px";
              backNav.dir = lang === "he" ? "rtl" : "ltr";

              const backBtn = document.createElement("button");
              backBtn.innerHTML = lang === "he" ? "➔ חזרה לרשימה" : "Back to list ➔";
              backBtn.style.background = "transparent";
              backBtn.style.border = "none";
              backBtn.style.color = "#fbbf24";
              backBtn.style.fontWeight = "bold";
              backBtn.style.fontSize = "13px";
              backBtn.style.cursor = "pointer";
              backBtn.style.display = "flex";
              backBtn.style.alignItems = "center";
              backBtn.onclick = (e) => {
                e.stopPropagation();
                viewState = 'list';
                renderPopupState();
              };
              
              backNav.appendChild(backBtn);
              popupContent.appendChild(backNav);
              popupContent.appendChild(createPopupNode(currentPoint, isSaved, map));
            }
          };

          renderPopupState();
        }

        marker.bindPopup(popupContent, {
          closeButton: true,
          className: "custom-popup",
          autoPan: true,
          maxWidth: 500,
          minWidth: 230,
          autoPanPaddingTopLeft: [0, 150],
          autoPanPaddingBottomRight: [0, 20]
        });

        marker.on("click", () => {
          map.setMaxBounds(null as any);
          const currentZoom = map.getZoom();

          if (count === 1) {
            const pId = Number(pointsInCat[0].id);
            globalClickedPoints.add(pId);
            
            fetch("/api/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pointId: pId }),
            })
            .then(() => {
                window.dispatchEvent(new Event("points-updated"));
            })
            .catch(console.error);
            
            marker.setIcon(createGroupedIcon(category, true, currentZoom, count));
          } else {
            const anyViewed = pointsInCat.some(p => 
              viewedIds.map(Number).includes(Number(p.id)) || globalClickedPoints.has(Number(p.id))
            );
            marker.setIcon(createGroupedIcon(category, anyViewed, currentZoom, count));
          }

          marker.openPopup();
        });

        marker.on("popupclose", () => {
          const worldBounds = L.latLngBounds([-90, -180], [90, 180]);
          map.setMaxBounds(worldBounds);
        });

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