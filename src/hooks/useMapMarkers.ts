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
  const markersRef = useRef<{ [key: number]: L.Marker }>({});
  const clickedLocallyRef = useRef<Set<number>>(new Set());

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
    container.dir = "rtl";

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    const display = (val: string | null | undefined) => (val && val.trim() !== "" ? val : "-");

    // 🌟 הקטנו את האייקונים ל-12x12 כדי שיהיו עדינים בדיוק כמו ה-X
    const expandSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/></svg>`;
    const collapseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M5.5 5a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 1 0v4A1.5 1.5 0 0 1 5.5 6h-4a.5.5 0 0 1 0-1h4zM10.5 5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 0-1 0v4A1.5 1.5 0 0 0 10.5 6h4a.5.5 0 0 0 0-1h-4zM5.5 11a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 1 0v-4A1.5 1.5 0 0 0 5.5 10h-4a.5.5 0 0 0 0 1h4zm5 0a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 10.5 10h4a.5.5 0 0 1 0 1h-4z"/></svg>`;

    const headerHtml = `
      <div style="position: relative; padding-top: 10px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #374151;">
        
        <div style="display: flex; align-items: flex-start; gap: 8px; padding-right: 15px; padding-left: 20px;">
          <div style="background: rgba(255, 255, 255, 0.1); border-radius: 50%; padding: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
            <img src="/icons/categories/${point.category}/active.png" alt="${point.category}" style="width: 18px; height: 18px; object-fit: contain;" />
          </div>
          
          <div class="point-title" style="font-weight: bold; font-size: 16px; color: #f9fafb; text-align: right; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; margin-top: 5px;">
            ${display(point.name)}
          </div>
        </div>
        
        <!-- 🌟 שינינו את ה-top ל--10px בשביל האמצע המושלם -->
        <button class="expand-point-btn" style="position: absolute; top: -10px; left: -20px; width: 30px; height: 30px; background: transparent; border: none; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.2s; z-index: 10;" title="הגדל חלונית">
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
            <img class="carousel-slide-${point.id} map-lightbox-trigger" data-images="${imagesJsonStr}" data-index="${i}" src="${src}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; display: ${i === 0 ? 'block' : 'none'}; cursor: pointer;" title="לחץ להגדלה" />
          `).join('')}
          <button class="carousel-prev-${point.id}" style="position: absolute; left: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">❮</button>
          <button class="carousel-next-${point.id}" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">❯</button>
          <div style="position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; z-index: 10; flex-direction: row-reverse;">
            ${imagesList.map((_, i) => `
              <div class="carousel-dot-${point.id}" data-index="${i}" style="width: 6px; height: 6px; border-radius: 50%; background: ${i === 0 ? '#ffffff' : 'rgba(255,255,255,0.4)'}; cursor: pointer;"></div>
            `).join('')}
          </div>
        </div>
      `;
    }

    const plantIconSrc = isSaved ? "/icons/ui/plant/active.png" : "/icons/ui/plant/default.png";
    let currentSavedCount = point._count?.savedBy || 0;

    container.innerHTML = `
      ${headerHtml}
      ${imageHtml}
      
      <div class="point-desc-container" style="max-height: 100px; overflow-y: auto; padding-right: 5px; font-size: 14px; color: #d1d5db;">
        <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">תיאור:</strong> ${display(point.description)}</div>
        <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">מיקום:</strong> ${display(point.address)}</div>
        ${point.extraInfo ? `<div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">מידע נוסף:</strong> ${point.extraInfo}</div>` : ""}
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
       <a href="https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes" target="_blank" style="text-decoration: none; display: flex; align-items: center;" title="נווט לשם">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#05c8f6" viewBox="0 0 16 16"><path d="M4 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.777 5.093c.123-.38.272-.733.447-1.053C2.81 2.915 3.86 2 5.25 2h5.5c1.39 0 2.44.915 3.026 2.04.175.32.324.672.447 1.053C14.743 6.134 15 7.155 15 8.125V11a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H4v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8.125c0-.97.257-1.99.777-3.032ZM3.7 5.021a1.5 1.5 0 0 0-1.187 1.5V7h10.974v-.479a1.5 1.5 0 0 0-1.187-1.5l-4.22-.844a1.5 1.5 0 0 0-.86 0l-4.22.844Z"/></svg>
        </a>
        <a class="wa-share-btn" href="#" target="_blank" style="text-decoration: none; font-size: 20px;" title="שתף בוואטסאפ">💬</a>
        <button class="copy-link-btn" style="background: none; border: none; cursor: pointer; font-size: 20px; padding: 0;" title="העתק קישור">🔗</button>
        <button class="report-btn" style="background: none; border: none; cursor: pointer; font-size: 20px; padding: 0;" title="דווח על בעיה">🚩</button>
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
        expandBtn.title = isExpanded ? "הקטן חלונית" : "הגדל חלונית";

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
    const waText = encodeURIComponent(`תראו איזה Seed מצאתי ב-JSeed! 🌱\n${shareUrl}`);

    const waBtn = container.querySelector(".wa-share-btn") as HTMLAnchorElement;
    if (waBtn) waBtn.href = `https://wa.me/?text=${waText}`;

    const copyBtn = container.querySelector(".copy-link-btn") as HTMLButtonElement;
    if (copyBtn) {
      copyBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        navigator.clipboard.writeText(shareUrl);
        alert("הקישור הועתק בהצלחה!");
      };
    }

    const reportBtn = container.querySelector(".report-btn") as HTMLButtonElement;
    if (reportBtn) {
      reportBtn.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        const reason = prompt("מה הבעיה בגרעין זה? (למשל: סגור, מידע שגוי, ספאם)");
        if (reason) {
          try {
            await fetch("/api/reports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pointId: point.id, reason })
            });
            alert("תודה! הדיווח נשלח למנהלי האתר.");
          } catch (err) {
            alert("תודה! הדיווח נרשם.");
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

    const linkBtn = container.querySelector(".point-website-link") as HTMLAnchorElement;
    if (linkBtn) {
      linkBtn.onclick = (e) => {
        fetch(`/api/points/${point.id}/click`, { method: "POST" }).catch(console.error);
      };
    }

    return container;
  }

  useEffect(() => {
    if (!map || !layerRef.current) return;

    layerRef.current.clearLayers();
    markersRef.current = {};

    const filtered = activeCategory
      ? points.filter((p) => p.category === activeCategory)
      : points;

    filtered.forEach((point) => {
      const isViewed = viewedIds.includes(point.id) || clickedLocallyRef.current.has(point.id);
      const isSaved = savedIds.includes(point.id);

      const marker = L.marker(
        [point.latitude, point.longitude],
        { icon: createCategoryIcon(point.category, isViewed, map.getZoom()) }
      );

      marker.bindPopup(createPopupNode(point, isSaved, map), {
        closeButton: true,
        className: "custom-popup",
        autoPan: true,
        maxWidth: 500,
        minWidth: 230,
        autoPanPaddingTopLeft: [0, 150],
        autoPanPaddingBottomRight: [0, 20]
      });

      marker.on("click", (e) => {
        map.setMaxBounds(null as any);
        const currentZoom = map.getZoom();

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

      marker.on("popupclose", () => {
        const worldBounds = L.latLngBounds([-90, -180], [90, 180]);
        map.setMaxBounds(worldBounds);
      });

      layerRef.current?.addLayer(marker);
      markersRef.current[point.id] = marker;
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

      filtered.forEach((point) => {
        const marker = markersRef.current[point.id];
        if (marker) {
          const isViewed = viewedIds.includes(point.id) || clickedLocallyRef.current.has(point.id);
          marker.setIcon(createCategoryIcon(point.category, isViewed, currentZoom));
        }
      });
    };

    map.on("zoomend", handleZoomEnd);

    return () => {
      map.off("zoomend", handleZoomEnd);
    };

  }, [map, points, activeCategory, viewedIds, savedIds]);
}