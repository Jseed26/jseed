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

const getPersistedViewed = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('jseed_viewed_points');
    if (stored) {
      try { return new Set<number>(JSON.parse(stored)); } catch (e) { }
    }
  }
  return new Set<number>();
};

const globalClickedPoints = getPersistedViewed();

const persistViewedPoint = (id: number) => {
  globalClickedPoints.add(id);
  if (typeof window !== 'undefined') {
    localStorage.setItem('jseed_viewed_points', JSON.stringify(Array.from(globalClickedPoints)));
  }
};

function createGroupedIcon(category: string, isViewed: boolean, zoom: number, count: number) {
  const iconUrl = `/icons/categories/${category}/${isViewed ? "viewed" : "default"}.png`;

  // 🌟 מתמטיקה מדורגת שמתחילה מ-10 בברירת המחדל וגדלה בהדרגה לפי רמת הזום
  let baseSize = 10;

  if (zoom >= 15) {
    baseSize = 32; // זום קרוב מאוד (עיר/רחוב)
  } else if (zoom >= 11) {
    baseSize = 24; // זום בינוני (אזור/עיר)
  } else if (zoom >= 6) {
    baseSize = 16; // זום רחוק (מדינה)
  }
  // מתחת לזום 6 יישאר 10 (מבט על העולם)

  // התאמת גודל התג (Badge) בהתאם לגודל האייקון החדש
  const badgeSize = baseSize < 20 ? 14 : (baseSize < 28 ? 16 : 20);
  const badgeFontSize = baseSize < 20 ? 9 : (baseSize < 28 ? 10 : 12);
  const badgeOffset = baseSize < 20 ? -3 : (baseSize < 28 ? -4 : -6);

  const badgeHtml = count > 1
    ? `<div style="position: absolute; top: ${badgeOffset}px; right: ${badgeOffset}px; background: #fbbf24; color: #000; border-radius: 50%; width: ${badgeSize}px; height: ${badgeSize}px; display: flex; align-items: center; justify-content: center; font-size: ${badgeFontSize}px; font-weight: 900; border: 1.5px solid #111827; box-shadow: 0 2px 4px rgba(0,0,0,0.5); z-index: 10;">${count}</div>`
    : '';

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${baseSize}px; height: ${baseSize}px; transition: all 0.3s ease-out;">
        <img src="${iconUrl}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.6));" />
        ${badgeHtml}
      </div>
    `,
    className: "",
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize / 2, baseSize],
    popupAnchor: [0, -baseSize / 2]
  });
}

function createArc(startLat: number, startLng: number, endLat: number, endLng: number) {
  const latlngs: L.LatLngExpression[] = [];
  const numPoints = 50;

  const midLat = (startLat + endLat) / 2;
  const midLng = (startLng + endLng) / 2;

  const dLat = endLat - startLat;
  const dLng = endLng - startLng;
  const distance = Math.sqrt(dLat * dLat + dLng * dLng);

  const curveOffset = distance * 0.2;

  const perpLat = -dLng;
  const perpLng = dLat;
  const length = Math.sqrt(perpLat * perpLat + perpLng * perpLng);

  const controlLat = midLat + (perpLat / length) * curveOffset;
  const controlLng = midLng + (perpLng / length) * curveOffset;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const u = 1 - t;
    const lat = u * u * startLat + 2 * u * t * controlLat + t * t * endLat;
    const lng = u * u * startLng + 2 * u * t * controlLng + t * t * endLng;
    latlngs.push([lat, lng]);
  }
  return latlngs;
}

export function useMapMarkers({ map, points, activeCategory, viewedIds = [], savedIds = [], lang = "he", searchQuery = "" }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<{ [key: number]: L.Marker }>({});

  useEffect(() => {
    const styleId = "jseed-smart-popups-v6";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .leaflet-popup.headless-popup { margin: 0 !important; }
        .headless-popup .leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; padding: 0 !important; overflow: visible !important; }
        .headless-popup .leaflet-popup-tip-container { display: none !important; }
        .headless-popup .leaflet-popup-content { margin: 0 !important; width: 0 !important; height: 0 !important; overflow: visible !important; display: flex; justify-content: center; align-items: center; }
        .jseed-custom-modal { position: absolute; background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.6); color: white; z-index: 1000; cursor: default; width: 400px; max-height: 65vh; overflow-y: auto; overflow-x: hidden; }
        .jseed-custom-modal::-webkit-scrollbar { width: 6px; }
        .jseed-custom-modal::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 8px; }
        .jseed-custom-modal::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.4); border-radius: 8px; }
        @media (max-width: 450px) { .jseed-custom-modal { width: 320px; } }
        .jseed-modal-tip { position: absolute; width: 0; height: 0; border-style: solid; }
        .jseed-modal-up { bottom: 25px; left: 0; transform: translateX(-50%); }
        .jseed-modal-up .jseed-modal-tip { bottom: -8px; left: 50%; transform: translateX(-50%); border-width: 8px 8px 0 8px; border-color: #111827 transparent transparent transparent; }
        .jseed-modal-down { top: 25px; left: 0; transform: translateX(-50%); }
        .jseed-modal-down .jseed-modal-tip { top: -8px; left: 50%; transform: translateX(-50%); border-width: 0 8px 8px 8px; border-color: transparent transparent #111827 transparent; }
        .jseed-modal-left { top: 0; right: 25px; transform: translateY(-50%); }
        .jseed-modal-left .jseed-modal-tip { right: -8px; top: 50%; transform: translateY(-50%); border-width: 8px 0 8px 8px; border-color: transparent transparent transparent #111827; }
        .jseed-modal-right { top: 0; left: 25px; transform: translateY(-50%); }
        .jseed-modal-right .jseed-modal-tip { left: -8px; top: 50%; transform: translateY(-50%); border-width: 8px 8px 8px 0; border-color: transparent #111827 transparent transparent; }
        .golden-thread-line { filter: drop-shadow(0px 0px 6px rgba(251, 191, 36, 1)); }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!map) return;
    layerRef.current = L.layerGroup().addTo(map);
    return () => { layerRef.current?.remove(); };
  }, [map]);

  function createPopupNode(point: Point, isSaved: boolean, mapInstance: L.Map) {
    const container = document.createElement("div");
    container.style.fontFamily = "sans-serif";

    const isMobile = window.innerWidth < 450;
    const textMaxHeight = isMobile ? "200px" : "350px";
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
      participants: isHe ? "משתתפים" : "Participants",
      zoomInText: isHe ? "הגדל טקסט" : "Increase text size",
      zoomOutText: isHe ? "הקטן טקסט" : "Decrease text size",
      commentsTitle: isHe ? "תגובות" : "Comments",
      addCommentPlaceholder: isHe ? "הכתוב תגובה..." : "Write a comment...",
      send: isHe ? "שלח" : "Send",
      loginToComment: isHe ? "יש להתחבר כדי להגיב" : "Log in to comment"
    };

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    const display = (val: string | null | undefined) => (val && val.trim() !== "" ? val : "-");
    const isChai = point.category === "chai";

    const headerHtml = `
      <div style="position: relative; padding-top: 10px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #374151;">
        <div style="display: flex; align-items: flex-start; gap: 8px; padding: ${isHe ? '0 15px 0 30px' : '0 30px 0 15px'};">
          <div style="background: rgba(255, 255, 255, 0.1); border-radius: 50%; padding: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
            <img src="/icons/categories/${point.category}/active.png" alt="${point.category}" style="width: 18px; height: 18px; object-fit: contain;" />
          </div>
          <div class="point-title" style="font-weight: bold; font-size: 16px; transition: font-size 0.2s; color: #f9fafb; text-align: ${isHe ? 'right' : 'left'}; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.3; margin-top: 5px;">
            ${display(displayName)}
          </div>
        </div>
      </div>
    `;

    const imagesList = point.imageUrls && point.imageUrls.length > 0 ? point.imageUrls : (point.imageUrl ? [point.imageUrl] : []);
    const imagesJsonStr = JSON.stringify(imagesList).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    let imageHtml = "";
    const verticalImgStyle = `width: 100%; aspect-ratio: 9/16; max-height: 280px; object-fit: cover; border-radius: 8px; background: #000; cursor: pointer;`;

    if (imagesList.length === 1) {
      imageHtml = `<img src="${imagesList[0]}" class="map-lightbox-trigger point-image-container" data-images="${imagesJsonStr}" data-index="0" style="${verticalImgStyle} margin-bottom: 8px;" title="לחץ להגדלה" />`;
    } else if (imagesList.length > 1) {
      imageHtml = `
        <div class="point-image-container" style="position: relative; width: 100%; aspect-ratio: 9/16; max-height: 280px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: #000;">
          ${imagesList.map((src, i) => `<img class="carousel-slide-${point.id} map-lightbox-trigger" data-images="${imagesJsonStr}" data-index="${i}" src="${src}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; display: ${i === 0 ? 'block' : 'none'}; cursor: pointer;" title="לחץ להגדלה" />`).join('')}
          <button class="carousel-prev-${point.id}" style="position: absolute; ${isHe ? 'left' : 'right'}: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">${isHe ? '❮' : '❯'}</button>
          <button class="carousel-next-${point.id}" style="position: absolute; ${isHe ? 'right' : 'left'}: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">${isHe ? '❯' : '❮'}</button>
          <div style="position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; z-index: 10; flex-direction: ${isHe ? 'row-reverse' : 'row'};">
            ${imagesList.map((_, i) => `<div class="carousel-dot-${point.id}" data-index="${i}" style="width: 6px; height: 6px; border-radius: 50%; background: ${i === 0 ? '#ffffff' : 'rgba(255,255,255,0.4)'}; cursor: pointer;"></div>`).join('')}
          </div>
        </div>
      `;
    }

    const saveIconSrc = isSaved ? "/icons/ui/save/active.png" : "/icons/ui/save/default.png";
    let currentSavedCount = point._count?.savedBy || 0;
    const participantsCount = isChai ? points.filter(p => p.category === "chai" && (p.name || "").trim() === (point.name || "").trim()).length : 0;

    container.innerHTML = `
      <div dir="${isHe ? 'rtl' : 'ltr'}" style="width: 100%; height: 100%; text-align: ${isHe ? 'right' : 'left'};">
        ${headerHtml}
        ${imageHtml}
        
        <div class="point-desc-container" style="max-height: ${textMaxHeight}; overflow-y: auto; padding-${isHe ? 'right' : 'left'}: 5px; font-size: 14px; transition: font-size 0.2s; color: #d1d5db;">
          <div style="margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <strong style="color: #f9fafb;">${t.desc}</strong> 
                  <div style="display: flex; gap: 8px;">
                    <button class="zoom-out-text" title="${t.zoomOutText}" style="background: none; border: none; color: #9ca3af; font-weight: bold; font-size: 14px; cursor: pointer; padding: 0;">A-</button>
                    <button class="zoom-in-text" title="${t.zoomInText}" style="background: none; border: none; color: #fbbf24; font-weight: bold; font-size: 14px; cursor: pointer; padding: 0;">A+</button>
                  </div>
              </div>
              <span style="white-space: pre-wrap; line-height: 1.5;">${display(displayDesc)}</span>
          </div>
          <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">${t.loc}</strong> <span dir="auto">${display(point.address)}</span></div>
          <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">${t.link}</strong> ${point.website ? `<a href="${point.website}" target="_blank" class="point-website-link" data-id="${point.id}" style="color: #fbbf24; text-decoration: none;">${t.visit}</a>` : "-"}</div>
        </div>
        
        <!-- נתוני שמירות ותגובות -->
        <div style="margin-top: 8px; border-top: 1px solid #374151; padding-top: 8px; display: flex; flex-direction: column; gap: 8px;">
          
          <!-- שורת שמירות -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <button class="save-point-btn" style="background: none; border: none; cursor: pointer; padding: 0; outline: none; display: flex; align-items: center; gap: 6px;">
              <img src="${saveIconSrc}" alt="Save" style="width: 16px; height: 16px; object-fit: contain; transition: transform 0.2s;" />
              <span class="saved-count-text" style="font-size: 12px; color: #9ca3af; font-weight: bold;">
                ${currentSavedCount} ${t.saves}
              </span>
            </button>
            
            ${isChai ? `
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size: 12px; color: #fbbf24; font-weight: bold; display: flex; align-items: center; gap: 4px;">🤝 ${participantsCount}${t.participants}</span>
              <button class="add-chai-btn" style="background: rgba(251,191,36,0.15); border: 1px solid #fbbf24; color: #fbbf24; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" title="הוסף נקודה ליוזמה זו"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg></button>
            </div>
            ` : ''}
          </div>

          <!-- שורת תגובות (שורה מתחת) -->
          <div style="display: flex; align-items: center;">
              <button class="toggle-comments-btn" style="background: none; border: none; cursor: pointer; padding: 0; outline: none; display: flex; align-items: center; gap: 6px; color: #9ca3af; font-size: 12px; font-weight: bold; transition: color 0.2s;">
                <img src="/icons/ui/comments/comments.png" alt="Comments" style="width: 16px; height: 16px; object-fit: contain;" />
                <span class="comments-count">${t.commentsTitle}</span>
              </button>
          </div>
        </div>

        <!-- אזור התגובות נפתח למטה -->
        <div class="comments-section" style="display: none; margin-top: 8px; max-height: 160px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px;">
          <div class="comments-list" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px;">
          </div>
          
          <div style="display: flex; gap: 6px;">
            <input type="text" class="new-comment-input" placeholder="${t.addCommentPlaceholder}" style="flex: 1; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 6px 10px; font-size: 12px; color: white; outline: none;" />
            <button class="send-comment-btn" style="background: none; border: none; color: #fbbf24; font-weight: bold; font-size: 13px; cursor: pointer; padding: 0 4px;">${t.send}</button>
          </div>
        </div>

       <div style="display: flex; justify-content: space-around; margin-top: 10px; padding-top: 8px; border-top: 1px solid #374151;">
         <a href="https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes" target="_blank" style="text-decoration: none; display: flex; align-items: center;" title="${t.nav}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#05c8f6" viewBox="0 0 16 16"><path d="M4 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.777 5.093c.123-.38.272-.733.447-1.053C2.81 2.915 3.86 2 5.25 2h5.5c1.39 0 2.44.915 3.026 2.04.175.32.324.672.447 1.053C14.743 6.134 15 7.155 15 8.125V11a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H4v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8.125c0-.97.257-1.99.777-3.032ZM3.7 5.021a1.5 1.5 0 0 0-1.187 1.5V7h10.974v-.479a1.5 1.5 0 0 0-1.187-1.5l-4.22-.844a1.5 1.5 0 0 0-.86 0l-4.22.844Z"/></svg>
         </a>
          <button class="native-share-btn" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; padding: 0;" title="${t.shareTip}">
            <img src="/icons/ui/whatsapp/whatsapp.png" alt="Share" style="width: 20px; height: 20px; object-fit: contain;" />
          </button>
          <button class="copy-link-btn" style="background: none; border: none; cursor: pointer; font-size: 16px; padding: 0;" title="${t.copyTip}">🔗</button>
          <button class="report-btn" style="background: none; border: none; cursor: pointer; font-size: 16px; padding: 0;" title="${t.reportTip}">🚩</button>
        </div>
      </div>
    `;

    const toggleCommentsBtn = container.querySelector(".toggle-comments-btn") as HTMLButtonElement;
    const commentsSection = container.querySelector(".comments-section") as HTMLElement;
    const commentsList = container.querySelector(".comments-list") as HTMLElement;
    const commentInput = container.querySelector(".new-comment-input") as HTMLInputElement;
    const sendCommentBtn = container.querySelector(".send-comment-btn") as HTMLButtonElement;
    const commentsCountSpan = container.querySelector(".comments-count") as HTMLSpanElement;

    let commentsLoaded = false;
    let currentUserId: string | null = null;

    const checkSession = async () => {
      if (currentUserId !== null) return;
      try {
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        if (session?.user?.id) currentUserId = session.user.id;
      } catch (e) { }
    };

    const fetchComments = async () => {
      await checkSession();
      try {
        const res = await fetch(`/api/comments?pointId=${point.id}`);
        if (res.ok) {
          const data = await res.json();
          commentsCountSpan.innerText = `${data.length} ${t.commentsTitle}`;
          commentsList.innerHTML = "";

          if (data.length === 0) {
            commentsList.innerHTML = `<div style="color: #9ca3af; font-size: 11px; text-align: center; padding: 4px;">אין עדיין תגובות. היה הראשון להגיב!</div>`;
          } else {
            data.forEach((c: any) => {
              const item = document.createElement("div");
              item.style.cssText = "background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 6px; font-size: 11px;";

              const isOwner = currentUserId && c.userId === currentUserId;
              const dateStr = new Date(c.createdAt).toLocaleDateString('he-IL');

              item.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <strong style="color: #fbbf24;">${c.user?.name || 'משתמש'}</strong>
                  <span style="color: #6b7280; font-size: 9px;">${dateStr}</span>
                </div>
                <div class="comment-content" style="color: #e5e7eb; word-break: break-word; margin-bottom: 4px;">${c.content}</div>
                ${isOwner ? `
                  <div style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid #374151; padding-top: 4px; margin-top: 4px;">
                    <button class="edit-comment-btn" data-id="${c.id}" data-content="${c.content.replace(/"/g, '&quot;')}" style="background: none; border: none; color: #60a5fa; cursor: pointer; font-size: 10px; padding: 0;">ערוך</button>
                    <button class="delete-comment-btn" data-id="${c.id}" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 10px; padding: 0;">מחק</button>
                  </div>
                ` : ''}
              `;

              if (isOwner) {
                const delBtn = item.querySelector(".delete-comment-btn") as HTMLButtonElement;
                delBtn.onclick = async (e) => {
                  e.preventDefault(); e.stopPropagation();
                  if (confirm("האם אתה בטוח שברצונך למחוק את התגובה?")) {
                    try {
                      const delRes = await fetch(`/api/comments?id=${c.id}`, { method: "DELETE" });
                      if (delRes.ok) fetchComments();
                    } catch (err) {
                      alert("שגיאה במחיקה");
                    }
                  }
                };

                const editBtn = item.querySelector(".edit-comment-btn") as HTMLButtonElement;
                editBtn.onclick = (e) => {
                  e.preventDefault(); e.stopPropagation();
                  const newContent = prompt("ערוך את התגובה:", editBtn.getAttribute("data-content") || "");
                  if (newContent && newContent.trim() !== "" && newContent !== c.content) {
                    fetch(`/api/comments`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ commentId: c.id, content: newContent })
                    }).then(res => {
                      if (res.ok) fetchComments();
                      else alert("שגיאה בעריכה");
                    }).catch(() => alert("שגיאה בעריכה"));
                  }
                };
              }

              commentsList.appendChild(item);
            });
          }
        }
      } catch (err) { }
    };

    if (toggleCommentsBtn && commentsSection) {
      toggleCommentsBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = commentsSection.style.display === "block";
        commentsSection.style.display = isOpen ? "none" : "block";
        toggleCommentsBtn.style.color = isOpen ? "#9ca3af" : "#fbbf24";
        if (!isOpen && !commentsLoaded) {
          fetchComments();
          commentsLoaded = true;
        }
      };
    }

    const postComment = async () => {
      await checkSession();
      const content = commentInput.value.trim();
      if (!content) return;

      sendCommentBtn.setAttribute("disabled", "true");
      try {
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pointId: point.id, content })
        });

        if (res.ok) {
          commentInput.value = "";
          fetchComments();
        } else {
          alert(t.loginReq);
        }
      } catch (err) {
        alert(t.loginReq);
      } finally {
        sendCommentBtn.removeAttribute("disabled");
      }
    };

    if (sendCommentBtn) {
      sendCommentBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); postComment(); };
    }
    if (commentInput) {
      commentInput.onclick = (e) => e.stopPropagation();
      commentInput.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") postComment(); };
    }

    let currentFontSize = 14;
    const updateFontSize = () => {
      const descBox = container.querySelector(".point-desc-container") as HTMLElement;
      const titleBox = container.querySelector(".point-title") as HTMLElement;
      if (descBox) descBox.style.fontSize = `${currentFontSize}px`;
      if (titleBox) titleBox.style.fontSize = `${currentFontSize + 2}px`;
    };

    const zoomInBtn = container.querySelector(".zoom-in-text") as HTMLButtonElement;
    if (zoomInBtn) {
      zoomInBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (currentFontSize < 24) { currentFontSize += 2; updateFontSize(); }
      };
    }

    const zoomOutBtn = container.querySelector(".zoom-out-text") as HTMLButtonElement;
    if (zoomOutBtn) {
      zoomOutBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (currentFontSize > 12) { currentFontSize -= 2; updateFontSize(); }
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
          window.dispatchEvent(new CustomEvent("open-map-lightbox", { detail: { images: imgsArray, index: idx } }));
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
          } catch (err) { alert(t.reportSuccess); }
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
              img.src = data.saved ? "/icons/ui/save/active.png" : "/icons/ui/save/default.png";
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
          if (img) img.style.transform = "scale(1)";
        }
      };
    }

    const linkBtn = container.querySelector(".point-website-link") as HTMLAnchorElement;
    if (linkBtn) {
      linkBtn.onclick = () => { fetch(`/api/points/${point.id}/click`, { method: "POST" }).catch(console.error); };
    }

    const addChaiBtn = container.querySelector(".add-chai-btn") as HTMLButtonElement;
    if (addChaiBtn) {
      addChaiBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        window.dispatchEvent(new CustomEvent("open-direct-add-form", {
          detail: { name: point.name, category: "chai", lat: point.latitude, lng: point.longitude, parentId: point.id }
        }));
      };
    }

    const shareBtn = container.querySelector(".native-share-btn") as HTMLButtonElement;
    if (shareBtn) {
      shareBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (navigator.share) {
          try {
            await navigator.share({
              title: displayName,
              text: t.waText,
              url: shareUrl,
            });
          } catch (err) {
            // במקרה שהמשתמש ביטל את חלון השיתוף
          }
        } else {
          // גיבוי למחשבים שבהם אין navigator.share נתמך
          navigator.clipboard.writeText(shareUrl);
          alert(t.copiedMsg);
        }
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

    if (activeCategory === "chai") {
      const pointsMap = new Map<number, Point>();
      points.forEach(p => pointsMap.set(p.id, p));

      const chaiGroups: Record<string, Point[]> = {};
      points.forEach(p => {
        if (p.category === "chai") {
          const nameKey = (p.name || "").trim().toLowerCase();
          if (nameKey) {
            if (!chaiGroups[nameKey]) chaiGroups[nameKey] = [];
            chaiGroups[nameKey].push(p);
          }
        }
      });

      const rootPointsMap = new Map<string, Point>();
      Object.entries(chaiGroups).forEach(([nameKey, group]) => {
        if (group.length > 0) {
          group.sort((a, b) => Number(a.id) - Number(b.id));
          rootPointsMap.set(nameKey, group[0]);
        }
      });

      points.forEach(child => {
        if (child.category === "chai") {
          let parent: Point | undefined = undefined;
          if (child.parentId) {
            parent = pointsMap.get(child.parentId);
          } else {
            const nameKey = (child.name || "").trim().toLowerCase();
            const root = rootPointsMap.get(nameKey);
            if (root && root.id !== child.id) {
              parent = root;
            }
          }
          if (parent) {
            if (parent.latitude !== child.latitude || parent.longitude !== child.longitude) {
              const arcLatLngs = createArc(parent.latitude, parent.longitude, child.latitude, child.longitude);
              const thread = L.polyline(arcLatLngs, { color: '#fbbf24', weight: 1.5, opacity: 0.8, lineCap: 'round', lineJoin: 'round', className: 'golden-thread-line' });
              layerRef.current?.addLayer(thread);
            }
          }
        }
      });
    }

    const groupedByLocation: Record<string, Record<string, Point[]>> = {};

    filtered.forEach(point => {
      const lat = Number(point.latitude).toFixed(4);
      const lng = Number(point.longitude).toFixed(4);
      const locKey = `${lat},${lng}`;
      if (!groupedByLocation[locKey]) { groupedByLocation[locKey] = {}; }
      if (!groupedByLocation[locKey][point.category]) { groupedByLocation[locKey][point.category] = []; }
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

        const popupContentWrapper = document.createElement("div");
        popupContentWrapper.className = "jseed-custom-modal jseed-modal-up";

        const tip = document.createElement("div");
        tip.className = "jseed-modal-tip";
        popupContentWrapper.appendChild(tip);

        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "✖";
        closeBtn.style.cssText = `position: absolute; top: 12px; ${lang === 'he' ? 'left' : 'right'}: 12px; background: none; border: none; color: #9ca3af; font-size: 16px; cursor: pointer; z-index: 20; padding: 4px;`;
        closeBtn.onclick = (e) => { e.stopPropagation(); map.closePopup(); };
        popupContentWrapper.appendChild(closeBtn);

        const innerContent = document.createElement("div");
        innerContent.style.width = "100%";
        popupContentWrapper.appendChild(innerContent);

        if (count === 1) {
          const singlePoint = pointsInCat[0];
          const isSaved = savedIds.includes(singlePoint.id);
          innerContent.appendChild(createPopupNode(singlePoint, isSaved, map));
        } else {
          let currentIndex = 0;
          const renderCurrentPoint = () => {
            innerContent.innerHTML = "";
            const currentPoint = pointsInCat[currentIndex];
            const pId = Number(currentPoint.id);
            const isSaved = savedIds.includes(currentPoint.id);

            if (!globalClickedPoints.has(pId)) {
              persistViewedPoint(pId);
              fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pointId: pId }) }).catch(console.error);
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

            const prevBtn = createBtn(lang === "he" ? "❯" : "❮", () => { currentIndex = (currentIndex > 0) ? currentIndex - 1 : count - 1; renderCurrentPoint(); });
            const nextBtn = createBtn(lang === "he" ? "❮" : "❯", () => { currentIndex = (currentIndex < count - 1) ? currentIndex + 1 : 0; renderCurrentPoint(); });
            const label = document.createElement("span");
            label.innerText = lang === "he" ? `נקודה ${currentIndex + 1} מתוך ${count}` : `Point ${currentIndex + 1} of ${count}`;
            label.style.fontSize = "12px";
            label.style.fontWeight = "bold";
            label.style.color = "#fbbf24";

            navBar.appendChild(prevBtn);
            navBar.appendChild(label);
            navBar.appendChild(nextBtn);

            innerContent.appendChild(navBar);
            innerContent.appendChild(createPopupNode(currentPoint, isSaved, map));
          };
          renderCurrentPoint();
        }

        marker.bindPopup(popupContentWrapper, { closeButton: false, className: "headless-popup", autoPan: false });

        marker.on("click", () => {
          const pt = map.latLngToContainerPoint(marker.getLatLng());
          const mapWidth = map.getSize().x;
          const mapHeight = map.getSize().y;

          let direction = "up";
          if (pt.y < mapHeight * 0.55) direction = "down";
          if (pt.x > mapWidth * 0.65) direction = "left";
          else if (pt.x < mapWidth * 0.35) direction = "right";

          popupContentWrapper.className = `jseed-custom-modal jseed-modal-${direction}`;

          const currentZoom = map.getZoom();
          if (count === 1) {
            const pId = Number(pointsInCat[0].id);
            if (!globalClickedPoints.has(pId)) {
              persistViewedPoint(pId);
              fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pointId: pId }) }).catch(console.error);
            }
          }
          marker.setIcon(createGroupedIcon(category, true, currentZoom, count));
          marker.openPopup();
        });

        layerRef.current?.addLayer(marker);
        pointsInCat.forEach(p => { markersRef.current[p.id] = marker; });
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
          const popup = targetMarker.getPopup();
          const content = popup?.getContent();
          if (content) {
            const wrapper = content as HTMLElement;
            wrapper.className = "jseed-custom-modal jseed-modal-up";
            targetMarker.openPopup();
          }
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
            const isAnyViewed = pointsInCat.some(p => viewedIds.map(Number).includes(Number(p.id)) || globalClickedPoints.has(Number(p.id)));
            marker.setIcon(createGroupedIcon(category, isAnyViewed, currentZoom, count));
          }
        });
      });
    };

    map.on("zoomend", handleZoomEnd);
    return () => { map.off("zoomend", handleZoomEnd); };
    

  }, [map, points, activeCategory, viewedIds, savedIds, lang, searchQuery]);

  

  return { createPopupNode };
}


// "use client";

// import { useEffect, useRef } from "react";
// import * as maptilersdk from "@maptiler/sdk";
// import { Point } from "@/src/types/point";

// type Props = {
//   map: maptilersdk.Map | null;
//   points: Point[];
//   activeCategory: Point["category"] | null;
//   viewedIds: number[];
//   savedIds?: number[];
//   lang?: "he" | "en";
//   searchQuery?: string;
// };

// const getPersistedViewed = () => {
//   if (typeof window !== "undefined") {
//     const stored = localStorage.getItem("jseed_viewed_points");
//     if (stored) {
//       try {
//         return new Set<number>(JSON.parse(stored));
//       } catch (e) {}
//     }
//   }
//   return new Set<number>();
// };

// const globalClickedPoints = getPersistedViewed();

// const persistViewedPoint = (id: number) => {
//   globalClickedPoints.add(id);
//   if (typeof window !== "undefined") {
//     localStorage.setItem(
//       "jseed_viewed_points",
//       JSON.stringify(Array.from(globalClickedPoints))
//     );
//   }
// };

// // 🌟 עדכון תוכן האייקון והגודל לפי רמת הזום בגלובוס
// function updateGroupedIconElement(
//   el: HTMLElement,
//   category: string,
//   isViewed: boolean,
//   zoom: number,
//   count: number
// ) {
//   const iconUrl = `/icons/categories/${category}/${isViewed ? "viewed" : "default"}.png`;

//   let baseSize = 10;
//   if (zoom >= 15) {
//     baseSize = 32;
//   } else if (zoom >= 11) {
//     baseSize = 24;
//   } else if (zoom >= 6) {
//     baseSize = 16;
//   }

//   const badgeSize = baseSize < 20 ? 14 : baseSize < 28 ? 16 : 20;
//   const badgeFontSize = baseSize < 20 ? 9 : baseSize < 28 ? 10 : 12;
//   const badgeOffset = baseSize < 20 ? -3 : baseSize < 28 ? -4 : -6;

//   const badgeHtml =
//     count > 1
//       ? `<div style="position: absolute; top: ${badgeOffset}px; right: ${badgeOffset}px; background: #fbbf24; color: #000; border-radius: 50%; width: ${badgeSize}px; height: ${badgeSize}px; display: flex; align-items: center; justify-content: center; font-size: ${badgeFontSize}px; font-weight: 900; border: 1.5px solid #111827; box-shadow: 0 2px 4px rgba(0,0,0,0.5); z-index: 10;">${count}</div>`
//       : "";

//   el.style.width = `${baseSize}px`;
//   el.style.height = `${baseSize}px`;
//   el.style.cursor = "pointer";

//   el.innerHTML = `
//     <div class="leaflet-marker-icon" style="position: relative; width: ${baseSize}px; height: ${baseSize}px; transition: width 0.25s ease-out, height 0.25s ease-out, filter 0.3s ease-in-out;">
//       <img src="${iconUrl}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.6));" />
//       ${badgeHtml}
//     </div>
//   `;
// }

// // 🌟 יצירת קשתות זהב (GeoJSON) עבור יוזמות "חי" על גבי הגלובוס ([lng, lat])
// function createArcLngLat(
//   startLat: number,
//   startLng: number,
//   endLat: number,
//   endLng: number
// ): [number, number][] {
//   const coords: [number, number][] = [];
//   const numPoints = 50;

//   const midLat = (startLat + endLat) / 2;
//   const midLng = (startLng + endLng) / 2;

//   const dLat = endLat - startLat;
//   const dLng = endLng - startLng;
//   const distance = Math.sqrt(dLat * dLat + dLng * dLng);
//   if (distance === 0) return coords;

//   const curveOffset = distance * 0.2;

//   const perpLat = -dLng;
//   const perpLng = dLat;
//   const length = Math.sqrt(perpLat * perpLat + perpLng * perpLng);

//   const controlLat = midLat + (perpLat / length) * curveOffset;
//   const controlLng = midLng + (perpLng / length) * curveOffset;

//   for (let i = 0; i <= numPoints; i++) {
//     const t = i / numPoints;
//     const u = 1 - t;
//     const lat = u * u * startLat + 2 * u * t * controlLat + t * t * endLat;
//     const lng = u * u * startLng + 2 * u * t * controlLng + t * t * endLng;
//     coords.push([lng, lat]);
//   }
//   return coords;
// }

// export function useMapMarkers({
//   map,
//   points,
//   activeCategory,
//   viewedIds = [],
//   savedIds = [],
//   lang = "he",
//   searchQuery = "",
// }: Props) {
//   const activeMarkersRef = useRef<maptilersdk.Marker[]>([]);
//   const markersByPointIdRef = useRef<{
//     [key: number]: { marker: maptilersdk.Marker; openModal: () => void };
//   }>({});
//   const activePopupRef = useRef<maptilersdk.Popup | null>(null);

//   useEffect(() => {
//     const styleId = "jseed-smart-popups-globe-v1";
//     if (!document.getElementById(styleId)) {
//       const style = document.createElement("style");
//       style.id = styleId;
//       style.innerHTML = `
//         .maplibregl-popup.headless-popup, .leaflet-popup.headless-popup { margin: 0 !important; z-index: 2000 !important; }
//         .headless-popup .maplibregl-popup-content, .headless-popup .leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; padding: 0 !important; overflow: visible !important; }
//         .headless-popup .maplibregl-popup-tip, .headless-popup .leaflet-popup-tip-container { display: none !important; }
//         .jseed-custom-modal { position: absolute; background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.6); color: white; z-index: 1000; cursor: default; width: 400px; max-height: 65vh; overflow-y: auto; overflow-x: hidden; }
//         .jseed-custom-modal::-webkit-scrollbar { width: 6px; }
//         .jseed-custom-modal::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 8px; }
//         .jseed-custom-modal::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.4); border-radius: 8px; }
//         @media (max-width: 450px) { .jseed-custom-modal { width: 320px; } }
//         .jseed-modal-tip { position: absolute; width: 0; height: 0; border-style: solid; }
//         .jseed-modal-up { bottom: 25px; left: 0; transform: translateX(-50%); }
//         .jseed-modal-up .jseed-modal-tip { bottom: -8px; left: 50%; transform: translateX(-50%); border-width: 8px 8px 0 8px; border-color: #111827 transparent transparent transparent; }
//         .jseed-modal-down { top: 25px; left: 0; transform: translateX(-50%); }
//         .jseed-modal-down .jseed-modal-tip { top: -8px; left: 50%; transform: translateX(-50%); border-width: 0 8px 8px 8px; border-color: transparent transparent #111827 transparent; }
//         .jseed-modal-left { top: 0; right: 25px; transform: translateY(-50%); }
//         .jseed-modal-left .jseed-modal-tip { right: -8px; top: 50%; transform: translateY(-50%); border-width: 8px 0 8px 8px; border-color: transparent transparent transparent #111827; }
//         .jseed-modal-right { top: 0; left: 25px; transform: translateY(-50%); }
//         .jseed-modal-right .jseed-modal-tip { left: -8px; top: 50%; transform: translateY(-50%); border-width: 8px 8px 8px 0; border-color: transparent #111827 transparent transparent; }
//       `;
//       document.head.appendChild(style);
//     }
//   }, []);

//   function createPopupNode(
//     point: Point,
//     isSaved: boolean,
//     mapInstance: maptilersdk.Map
//   ) {
//     const container = document.createElement("div");
//     container.style.fontFamily = "sans-serif";

//     const isMobile = window.innerWidth < 450;
//     const textMaxHeight = isMobile ? "200px" : "350px";
//     const isHe = lang === "he";
//     container.dir = isHe ? "rtl" : "ltr";

//     const displayName = isHe ? point.name : point.name_en || point.name;
//     const displayDesc = isHe
//       ? point.description
//       : point.description_en || point.description;

//     const t = {
//       desc: isHe ? "תיאור:" : "Description:",
//       loc: isHe ? "מיקום:" : "Location:",
//       link: isHe ? "קישור:" : "Website:",
//       visit: isHe ? "למעבר לאתר" : "Visit Website",
//       saves: isHe ? "שמירות" : "Saves",
//       nav: isHe ? "נווט לשם" : "Navigate",
//       shareTip: isHe ? "שתף בוואטסאפ" : "Share on WhatsApp",
//       copyTip: isHe ? "העתק קישור" : "Copy Link",
//       reportTip: isHe ? "דווח על בעיה" : "Report Issue",
//       copiedMsg: isHe ? "הקישור הועתק בהצלחה!" : "Link copied successfully!",
//       reportMsg: isHe
//         ? "מה הבעיה בגרעין זה? (למשל: סגור, מידע שגוי, ספאם)"
//         : "What is the issue? (e.g., Closed, Wrong info, Spam)",
//       reportSuccess: isHe
//         ? "תודה! הדיווח נשלח למנהלי האתר."
//         : "Thank you! The report has been sent.",
//       loginReq: isHe
//         ? "צריך להתחבר כדי לשמור נקודות"
//         : "Please log in to save seeds",
//       waText: isHe
//         ? "תראו איזה Seed מצאתי ב-JSeed! 🌱"
//         : "Check out this Seed I found on JSeed! 🌱",
//       participants: isHe ? "משתתפים" : "Participants",
//       zoomInText: isHe ? "הגדל טקסט" : "Increase text size",
//       zoomOutText: isHe ? "הקטן טקסט" : "Decrease text size",
//       commentsTitle: isHe ? "תגובות" : "Comments",
//       addCommentPlaceholder: isHe ? "כתוב תגובה..." : "Write a comment...",
//       send: isHe ? "שלח" : "Send",
//       loginToComment: isHe ? "יש להתחבר כדי להגיב" : "Log in to comment",
//     };

//     container.addEventListener("click", (e) => e.stopPropagation());
//     container.addEventListener("wheel", (e) => e.stopPropagation());

//     const display = (val: string | null | undefined) =>
//       val && val.trim() !== "" ? val : "-";
//     const isChai = point.category === "chai";

//     const headerHtml = `
//       <div style="position: relative; padding-top: 10px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #374151;">
//         <div style="display: flex; align-items: flex-start; gap: 8px; padding: ${isHe ? "0 15px 0 30px" : "0 30px 0 15px"};">
//           <div style="background: rgba(255, 255, 255, 0.1); border-radius: 50%; padding: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
//             <img src="/icons/categories/${point.category}/active.png" alt="${point.category}" style="width: 18px; height: 18px; object-fit: contain;" />
//           </div>
//           <div class="point-title" style="font-weight: bold; font-size: 16px; transition: font-size 0.2s; color: #f9fafb; text-align: ${isHe ? "right" : "left"}; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.3; margin-top: 5px;">
//             ${display(displayName)}
//           </div>
//         </div>
//       </div>
//     `;

//     const imagesList =
//       point.imageUrls && point.imageUrls.length > 0
//         ? point.imageUrls
//         : point.imageUrl
//         ? [point.imageUrl]
//         : [];
//     const imagesJsonStr = JSON.stringify(imagesList)
//       .replace(/'/g, "&apos;")
//       .replace(/"/g, "&quot;");

//     let imageHtml = "";
//     const verticalImgStyle = `width: 100%; aspect-ratio: 9/16; max-height: 280px; object-fit: cover; border-radius: 8px; background: #000; cursor: pointer;`;

//     if (imagesList.length === 1) {
//       imageHtml = `<img src="${imagesList[0]}" class="map-lightbox-trigger point-image-container" data-images="${imagesJsonStr}" data-index="0" style="${verticalImgStyle} margin-bottom: 8px;" title="לחץ להגדלה" />`;
//     } else if (imagesList.length > 1) {
//       imageHtml = `
//         <div class="point-image-container" style="position: relative; width: 100%; aspect-ratio: 9/16; max-height: 280px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: #000;">
//           ${imagesList
//             .map(
//               (src, i) =>
//                 `<img class="carousel-slide-${point.id} map-lightbox-trigger" data-images="${imagesJsonStr}" data-index="${i}" src="${src}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; display: ${i === 0 ? "block" : "none"}; cursor: pointer;" title="לחץ להגדלה" />`
//             )
//             .join("")}
//           <button class="carousel-prev-${point.id}" style="position: absolute; ${isHe ? "left" : "right"}: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">${isHe ? "❮" : "❯"}</button>
//           <button class="carousel-next-${point.id}" style="position: absolute; ${isHe ? "right" : "left"}: 4px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 10px;">${isHe ? "❯" : "❮"}</button>
//           <div style="position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; z-index: 10; flex-direction: ${isHe ? "row-reverse" : "row"};">
//             ${imagesList
//               .map(
//                 (_, i) =>
//                   `<div class="carousel-dot-${point.id}" data-index="${i}" style="width: 6px; height: 6px; border-radius: 50%; background: ${i === 0 ? "#ffffff" : "rgba(255,255,255,0.4)"}; cursor: pointer;"></div>`
//               )
//               .join("")}
//           </div>
//         </div>
//       `;
//     }

//     const saveIconSrc = isSaved
//       ? "/icons/ui/save/active.png"
//       : "/icons/ui/save/default.png";
//     let currentSavedCount = point._count?.savedBy || 0;
//     const participantsCount = isChai
//       ? points.filter(
//           (p) =>
//             p.category === "chai" &&
//             (p.name || "").trim() === (point.name || "").trim()
//         ).length
//       : 0;

//     container.innerHTML = `
//       <div dir="${isHe ? "rtl" : "ltr"}" style="width: 100%; height: 100%; text-align: ${isHe ? "right" : "left"};">
//         ${headerHtml}
//         ${imageHtml}
        
//         <div class="point-desc-container" style="max-height: ${textMaxHeight}; overflow-y: auto; padding-${isHe ? "right" : "left"}: 5px; font-size: 14px; transition: font-size 0.2s; color: #d1d5db;">
//           <div style="margin-bottom: 10px;">
//               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
//                   <strong style="color: #f9fafb;">${t.desc}</strong> 
//                   <div style="display: flex; gap: 8px;">
//                     <button class="zoom-out-text" title="${t.zoomOutText}" style="background: none; border: none; color: #9ca3af; font-weight: bold; font-size: 14px; cursor: pointer; padding: 0;">A-</button>
//                     <button class="zoom-in-text" title="${t.zoomInText}" style="background: none; border: none; color: #fbbf24; font-weight: bold; font-size: 14px; cursor: pointer; padding: 0;">A+</button>
//                   </div>
//               </div>
//               <span style="white-space: pre-wrap; line-height: 1.5;">${display(displayDesc)}</span>
//           </div>
//           <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">${t.loc}</strong> <span dir="auto">${display(point.address)}</span></div>
//           <div style="margin-bottom: 6px;"><strong style="color: #f9fafb;">${t.link}</strong> ${point.website ? `<a href="${point.website}" target="_blank" class="point-website-link" data-id="${point.id}" style="color: #fbbf24; text-decoration: none;">${t.visit}</a>` : "-"}</div>
//         </div>
        
//         <div style="margin-top: 8px; border-top: 1px solid #374151; padding-top: 8px; display: flex; flex-direction: column; gap: 8px;">
//           <div style="display: flex; justify-content: space-between; align-items: center;">
//             <button class="save-point-btn" style="background: none; border: none; cursor: pointer; padding: 0; outline: none; display: flex; align-items: center; gap: 6px;">
//               <img src="${saveIconSrc}" alt="Save" style="width: 16px; height: 16px; object-fit: contain; transition: transform 0.2s;" />
//               <span class="saved-count-text" style="font-size: 12px; color: #9ca3af; font-weight: bold;">
//                 ${currentSavedCount} ${t.saves}
//               </span>
//             </button>
            
//             ${
//               isChai
//                 ? `
//             <div style="display: flex; gap: 8px; align-items: center;">
//               <span style="font-size: 12px; color: #fbbf24; font-weight: bold; display: flex; align-items: center; gap: 4px;">🤝 ${participantsCount} ${t.participants}</span>
//               <button class="add-chai-btn" style="background: rgba(251,191,36,0.15); border: 1px solid #fbbf24; color: #fbbf24; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" title="הוסף נקודה ליוזמה זו"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg></button>
//             </div>
//             `
//                 : ""
//             }
//           </div>

//           <div style="display: flex; align-items: center;">
//               <button class="toggle-comments-btn" style="background: none; border: none; cursor: pointer; padding: 0; outline: none; display: flex; align-items: center; gap: 6px; color: #9ca3af; font-size: 12px; font-weight: bold; transition: color 0.2s;">
//                 <img src="/icons/ui/comments/comments.png" alt="Comments" style="width: 16px; height: 16px; object-fit: contain;" />
//                 <span class="comments-count">${t.commentsTitle}</span>
//               </button>
//           </div>
//         </div>

//         <div class="comments-section" style="display: none; margin-top: 8px; max-height: 160px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px;">
//           <div class="comments-list" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px;">
//           </div>
          
//           <div style="display: flex; gap: 6px;">
//             <input type="text" class="new-comment-input" placeholder="${t.addCommentPlaceholder}" style="flex: 1; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 6px 10px; font-size: 12px; color: white; outline: none;" />
//             <button class="send-comment-btn" style="background: none; border: none; color: #fbbf24; font-weight: bold; font-size: 13px; cursor: pointer; padding: 0 4px;">${t.send}</button>
//           </div>
//         </div>

//        <div style="display: flex; justify-content: space-around; margin-top: 10px; padding-top: 8px; border-top: 1px solid #374151;">
//           <a href="https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes" target="_blank" style="text-decoration: none; display: flex; align-items: center;" title="${t.nav}">
//             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#05c8f6" viewBox="0 0 16 16"><path d="M4 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.777 5.093c.123-.38.272-.733.447-1.053C2.81 2.915 3.86 2 5.25 2h5.5c1.39 0 2.44.915 3.026 2.04.175.32.324.672.447 1.053C14.743 6.134 15 7.155 15 8.125V11a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H4v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8.125c0-.97.257-1.99.777-3.032ZM3.7 5.021a1.5 1.5 0 0 0-1.187 1.5V7h10.974v-.479a1.5 1.5 0 0 0-1.187-1.5l-4.22-.844a1.5 1.5 0 0 0-.86 0l-4.22.844Z"/></svg>
//           </a>
//           <a class="wa-share-btn" href="#" target="_blank" style="text-decoration: none; display: flex; align-items: center;" title="${t.shareTip}">
//             <img src="/icons/ui/whatsapp/whatsapp.png" alt="WhatsApp" style="width: 20px; height: 20px; object-fit: contain;" />
//           </a>
//           <button class="copy-link-btn" style="background: none; border: none; cursor: pointer; font-size: 16px; padding: 0;" title="${t.copyTip}">🔗</button>
//           <button class="report-btn" style="background: none; border: none; cursor: pointer; font-size: 16px; padding: 0;" title="${t.reportTip}">🚩</button>
//         </div>
//     `;

//     const toggleCommentsBtn = container.querySelector(".toggle-comments-btn") as HTMLButtonElement;
//     const commentsSection = container.querySelector(".comments-section") as HTMLElement;
//     const commentsList = container.querySelector(".comments-list") as HTMLElement;
//     const commentInput = container.querySelector(".new-comment-input") as HTMLInputElement;
//     const sendCommentBtn = container.querySelector(".send-comment-btn") as HTMLButtonElement;
//     const commentsCountSpan = container.querySelector(".comments-count") as HTMLSpanElement;

//     let commentsLoaded = false;
//     let currentUserId: string | null = null;

//     const checkSession = async () => {
//       if (currentUserId !== null) return;
//       try {
//         const res = await fetch("/api/auth/session");
//         const session = await res.json();
//         if (session?.user?.id) currentUserId = session.user.id;
//       } catch (e) {}
//     };

//     const fetchComments = async () => {
//       await checkSession();
//       try {
//         const res = await fetch(`/api/comments?pointId=${point.id}`);
//         if (res.ok) {
//           const data = await res.json();
//           commentsCountSpan.innerText = `${data.length} ${t.commentsTitle}`;
//           commentsList.innerHTML = "";

//           if (data.length === 0) {
//             commentsList.innerHTML = `<div style="color: #9ca3af; font-size: 11px; text-align: center; padding: 4px;">אין עדיין תגובות. היה הראשון להגיב!</div>`;
//           } else {
//             data.forEach((c: any) => {
//               const item = document.createElement("div");
//               item.style.cssText =
//                 "background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 6px; font-size: 11px;";

//               const isOwner = currentUserId && c.userId === currentUserId;
//               const dateStr = new Date(c.createdAt).toLocaleDateString("he-IL");

//               item.innerHTML = `
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
//                   <strong style="color: #fbbf24;">${c.user?.name || "משתמש"}</strong>
//                   <span style="color: #6b7280; font-size: 9px;">${dateStr}</span>
//                 </div>
//                 <div class="comment-content" style="color: #e5e7eb; word-break: break-word; margin-bottom: 4px;">${c.content}</div>
//                 ${
//                   isOwner
//                     ? `
//                   <div style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid #374151; padding-top: 4px; margin-top: 4px;">
//                     <button class="edit-comment-btn" data-id="${c.id}" data-content="${c.content.replace(/"/g, "&quot;")}" style="background: none; border: none; color: #60a5fa; cursor: pointer; font-size: 10px; padding: 0;">ערוך</button>
//                     <button class="delete-comment-btn" data-id="${c.id}" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 10px; padding: 0;">מחק</button>
//                   </div>
//                 `
//                     : ""
//                 }
//               `;

//               if (isOwner) {
//                 const delBtn = item.querySelector(".delete-comment-btn") as HTMLButtonElement;
//                 delBtn.onclick = async (e) => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   if (confirm("האם אתה בטוח שברצונך למחוק את התגובה?")) {
//                     try {
//                       const delRes = await fetch(`/api/comments?id=${c.id}`, {
//                         method: "DELETE",
//                       });
//                       if (delRes.ok) fetchComments();
//                     } catch (err) {
//                       alert("שגיאה במחיקה");
//                     }
//                   }
//                 };

//                 const editBtn = item.querySelector(".edit-comment-btn") as HTMLButtonElement;
//                 editBtn.onclick = (e) => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   const newContent = prompt(
//                     "ערוך את התגובה:",
//                     editBtn.getAttribute("data-content") || ""
//                   );
//                   if (newContent && newContent.trim() !== "" && newContent !== c.content) {
//                     fetch(`/api/comments`, {
//                       method: "PUT",
//                       headers: { "Content-Type": "application/json" },
//                       body: JSON.stringify({ commentId: c.id, content: newContent }),
//                     })
//                       .then((res) => {
//                         if (res.ok) fetchComments();
//                         else alert("שגיאה בעריכה");
//                       })
//                       .catch(() => alert("שגיאה בעריכה"));
//                   }
//                 };
//               }

//               commentsList.appendChild(item);
//             });
//           }
//         }
//       } catch (err) {}
//     };

//     if (toggleCommentsBtn && commentsSection) {
//       toggleCommentsBtn.onclick = (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         const isOpen = commentsSection.style.display === "block";
//         commentsSection.style.display = isOpen ? "none" : "block";
//         toggleCommentsBtn.style.color = isOpen ? "#9ca3af" : "#fbbf24";
//         if (!isOpen && !commentsLoaded) {
//           fetchComments();
//           commentsLoaded = true;
//         }
//       };
//     }

//     const postComment = async () => {
//       await checkSession();
//       const content = commentInput.value.trim();
//       if (!content) return;

//       sendCommentBtn.setAttribute("disabled", "true");
//       try {
//         const res = await fetch("/api/comments", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ pointId: point.id, content }),
//         });

//         if (res.ok) {
//           commentInput.value = "";
//           fetchComments();
//         } else {
//           alert(t.loginReq);
//         }
//       } catch (err) {
//         alert(t.loginReq);
//       } finally {
//         sendCommentBtn.removeAttribute("disabled");
//       }
//     };

//     if (sendCommentBtn) {
//       sendCommentBtn.onclick = (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         postComment();
//       };
//     }
//     if (commentInput) {
//       commentInput.onclick = (e) => e.stopPropagation();
//       commentInput.onkeydown = (e) => {
//         e.stopPropagation();
//         if (e.key === "Enter") postComment();
//       };
//     }

//     let currentFontSize = 14;
//     const updateFontSize = () => {
//       const descBox = container.querySelector(".point-desc-container") as HTMLElement;
//       const titleBox = container.querySelector(".point-title") as HTMLElement;
//       if (descBox) descBox.style.fontSize = `${currentFontSize}px`;
//       if (titleBox) titleBox.style.fontSize = `${currentFontSize + 2}px`;
//     };

//     const zoomInBtn = container.querySelector(".zoom-in-text") as HTMLButtonElement;
//     if (zoomInBtn) {
//       zoomInBtn.onclick = (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         if (currentFontSize < 24) {
//           currentFontSize += 2;
//           updateFontSize();
//         }
//       };
//     }

//     const zoomOutBtn = container.querySelector(".zoom-out-text") as HTMLButtonElement;
//     if (zoomOutBtn) {
//       zoomOutBtn.onclick = (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         if (currentFontSize > 12) {
//           currentFontSize -= 2;
//           updateFontSize();
//         }
//       };
//     }

//     const lightBoxTriggers = container.querySelectorAll(".map-lightbox-trigger");
//     lightBoxTriggers.forEach((trigger) => {
//       trigger.addEventListener("click", (e) => {
//         const target = e.target as HTMLElement;
//         const imgsJson = target.getAttribute("data-images") || "[]";
//         const idx = parseInt(target.getAttribute("data-index") || "0");
//         try {
//           const imgsArray = JSON.parse(imgsJson);
//           window.dispatchEvent(
//             new CustomEvent("open-map-lightbox", {
//               detail: { images: imgsArray, index: idx },
//             })
//           );
//         } catch (err) {}
//       });
//     });

//     if (imagesList.length > 1) {
//       let currentIndex = 0;
//       const slides = container.querySelectorAll(
//         `.carousel-slide-${point.id}`
//       ) as NodeListOf<HTMLImageElement>;
//       const dots = container.querySelectorAll(
//         `.carousel-dot-${point.id}`
//       ) as NodeListOf<HTMLDivElement>;
//       const btnPrev = container.querySelector(
//         `.carousel-prev-${point.id}`
//       ) as HTMLButtonElement;
//       const btnNext = container.querySelector(
//         `.carousel-next-${point.id}`
//       ) as HTMLButtonElement;

//       const showSlide = (index: number) => {
//         slides.forEach((s, i) => (s.style.display = i === index ? "block" : "none"));
//         dots.forEach(
//           (d, i) =>
//             (d.style.background =
//               i === index ? "#ffffff" : "rgba(255,255,255,0.4)")
//         );
//       };

//       if (btnPrev)
//         btnPrev.onclick = (e) => {
//           e.preventDefault();
//           e.stopPropagation();
//           currentIndex = currentIndex > 0 ? currentIndex - 1 : imagesList.length - 1;
//           showSlide(currentIndex);
//         };

//       if (btnNext)
//         btnNext.onclick = (e) => {
//           e.preventDefault();
//           e.stopPropagation();
//           currentIndex = currentIndex < imagesList.length - 1 ? currentIndex + 1 : 0;
//           showSlide(currentIndex);
//         };

//       dots.forEach((dot) => {
//         dot.onclick = (e) => {
//           e.preventDefault();
//           e.stopPropagation();
//           const target = e.target as HTMLElement;
//           currentIndex = parseInt(target.getAttribute("data-index") || "0");
//           showSlide(currentIndex);
//         };
//       });
//     }

//     const baseUrl = window.location.origin;
//     const shareUrl = `${baseUrl}/?point=${point.id}`;
//     const waTextUrl = encodeURIComponent(`${t.waText}\n${shareUrl}`);

//     const waBtn = container.querySelector(".wa-share-btn") as HTMLAnchorElement;
//     if (waBtn) waBtn.href = `https://wa.me/?text=${waTextUrl}`;

//     const copyBtn = container.querySelector(".copy-link-btn") as HTMLButtonElement;
//     if (copyBtn) {
//       copyBtn.onclick = (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         navigator.clipboard.writeText(shareUrl);
//         alert(t.copiedMsg);
//       };
//     }

//     const reportBtn = container.querySelector(".report-btn") as HTMLButtonElement;
//     if (reportBtn) {
//       reportBtn.onclick = async (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         const reason = prompt(t.reportMsg);
//         if (reason) {
//           try {
//             await fetch("/api/reports", {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ pointId: point.id, reason }),
//             });
//             alert(t.reportSuccess);
//           } catch (err) {
//             alert(t.reportSuccess);
//           }
//         }
//       };
//     }

//     const btn = container.querySelector(".save-point-btn") as HTMLButtonElement;
//     const countText = container.querySelector(".saved-count-text") as HTMLSpanElement;

//     if (btn) {
//       btn.onclick = async (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         const img = btn.querySelector("img");
//         if (img) img.style.transform = "scale(0.8)";
//         try {
//           const res = await fetch("/api/saved", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ pointId: point.id }),
//           });
//           if (res.ok) {
//             const data = await res.json();
//             if (img) {
//               img.src = data.saved
//                 ? "/icons/ui/save/active.png"
//                 : "/icons/ui/save/default.png";
//               img.style.transform = "scale(1)";
//             }
//             if (data.saved) currentSavedCount += 1;
//             else currentSavedCount -= 1;
//             if (countText) countText.innerText = `${currentSavedCount} ${t.saves}`;
//           } else {
//             if (img) img.style.transform = "scale(1)";
//             alert(t.loginReq);
//           }
//         } catch (err) {
//           if (img) img.style.transform = "scale(1)";
//         }
//       };
//     }

//     const linkBtn = container.querySelector(".point-website-link") as HTMLAnchorElement;
//     if (linkBtn) {
//       linkBtn.onclick = () => {
//         fetch(`/api/points/${point.id}/click`, { method: "POST" }).catch(
//           console.error
//         );
//       };
//     }

//     const addChaiBtn = container.querySelector(".add-chai-btn") as HTMLButtonElement;
//     if (addChaiBtn) {
//       addChaiBtn.onclick = (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         window.dispatchEvent(
//           new CustomEvent("open-direct-add-form", {
//             detail: {
//               name: point.name,
//               category: "chai",
//               lat: point.latitude,
//               lng: point.longitude,
//               parentId: point.id,
//             },
//           })
//         );
//       };
//     }

//     return container;
//   }

//   useEffect(() => {
//     if (!map) return;

//     // 1. ניקוי מרקרים, פופאפים וקשתות קודמים
//     activePopupRef.current?.remove();
//     activePopupRef.current = null;
//     activeMarkersRef.current.forEach((m) => m.remove());
//     activeMarkersRef.current = [];
//     markersByPointIdRef.current = {};

//     try {
//       if (map.getLayer("chai-arcs-layer")) map.removeLayer("chai-arcs-layer");
//       if (map.getLayer("chai-arcs-glow")) map.removeLayer("chai-arcs-glow");
//       if (map.getSource("chai-arcs")) map.removeSource("chai-arcs");
//     } catch (e) {}

//     const filtered = points.filter((p) => {
//       return activeCategory ? p.category === activeCategory : true;
//     });

//     // 2. ציור חוטי הזהב (Arcs) על גבי הגלובוס עבור קטגוריית "חי"
//     if (activeCategory === "chai") {
//       const pointsMap = new Map<number, Point>();
//       points.forEach((p) => pointsMap.set(p.id, p));

//       const chaiGroups: Record<string, Point[]> = {};
//       points.forEach((p) => {
//         if (p.category === "chai") {
//           const nameKey = (p.name || "").trim().toLowerCase();
//           if (nameKey) {
//             if (!chaiGroups[nameKey]) chaiGroups[nameKey] = [];
//             chaiGroups[nameKey].push(p);
//           }
//         }
//       });

//       const rootPointsMap = new Map<string, Point>();
//       Object.entries(chaiGroups).forEach(([nameKey, group]) => {
//         if (group.length > 0) {
//           group.sort((a, b) => Number(a.id) - Number(b.id));
//           rootPointsMap.set(nameKey, group[0]);
//         }
//       });

//       const arcFeatures: any[] = [];

//       points.forEach((child) => {
//         if (child.category === "chai") {
//           let parent: Point | undefined = undefined;
//           if (child.parentId) {
//             parent = pointsMap.get(child.parentId);
//           } else {
//             const nameKey = (child.name || "").trim().toLowerCase();
//             const root = rootPointsMap.get(nameKey);
//             if (root && root.id !== child.id) {
//               parent = root;
//             }
//           }
//           if (
//             parent &&
//             (parent.latitude !== child.latitude ||
//               parent.longitude !== child.longitude)
//           ) {
//             const coordinates = createArcLngLat(
//               Number(parent.latitude),
//               Number(parent.longitude),
//               Number(child.latitude),
//               Number(child.longitude)
//             );
//             if (coordinates.length > 0) {
//               arcFeatures.push({
//                 type: "Feature",
//                 geometry: {
//                   type: "LineString",
//                   coordinates,
//                 },
//                 properties: {},
//               });
//             }
//           }
//         }
//       });

//       if (arcFeatures.length > 0) {
//         try {
//           map.addSource("chai-arcs", {
//             type: "geojson",
//             data: {
//               type: "FeatureCollection",
//               features: arcFeatures,
//             },
//           });

//           map.addLayer({
//             id: "chai-arcs-glow",
//             type: "line",
//             source: "chai-arcs",
//             paint: {
//               "line-color": "#fbbf24",
//               "line-width": 5,
//               "line-opacity": 0.35,
//               "line-blur": 4,
//             },
//           });

//           map.addLayer({
//             id: "chai-arcs-layer",
//             type: "line",
//             source: "chai-arcs",
//             layout: {
//               "line-cap": "round",
//               "line-join": "round",
//             },
//             paint: {
//               "line-color": "#fbbf24",
//               "line-width": 1.8,
//               "line-opacity": 0.9,
//             },
//           });
//         } catch (e) {}
//       }
//     }

//     // 3. קיבוץ נקודות לפי מיקום וקטגוריה
//     const groupedByLocation: Record<string, Record<string, Point[]>> = {};

//     filtered.forEach((point) => {
//       const lat = Number(point.latitude).toFixed(4);
//       const lng = Number(point.longitude).toFixed(4);
//       const locKey = `${lat},${lng}`;
//       if (!groupedByLocation[locKey]) groupedByLocation[locKey] = {};
//       if (!groupedByLocation[locKey][point.category])
//         groupedByLocation[locKey][point.category] = [];
//       groupedByLocation[locKey][point.category].push(point);
//     });

//     const markerUpdaters: Array<(zoom: number) => void> = [];

//     Object.entries(groupedByLocation).forEach(([locKey, categoriesGroup]) => {
//       const [centerLatStr, centerLngStr] = locKey.split(",");
//       const centerLat = parseFloat(centerLatStr);
//       const centerLng = parseFloat(centerLngStr);

//       const categoriesList = Object.keys(categoriesGroup);
//       const numCategories = categoriesList.length;

//       categoriesList.forEach((category, index) => {
//         const pointsInCat = categoriesGroup[category];
//         const count = pointsInCat.length;

//         let finalLat = centerLat;
//         let finalLng = centerLng;

//         if (numCategories > 1) {
//           const angle = (index * 2 * Math.PI) / numCategories;
//           const radius = 0.00015;
//           finalLat += radius * Math.cos(angle);
//           finalLng += radius * Math.sin(angle);
//         }

//         const checkIsAnyViewed = () =>
//           pointsInCat.some(
//             (p) =>
//               viewedIds.map(Number).includes(Number(p.id)) ||
//               globalClickedPoints.has(Number(p.id))
//           );

//         const el = document.createElement("div");
//         updateGroupedIconElement(
//           el,
//           category,
//           checkIsAnyViewed(),
//           map.getZoom(),
//           count
//         );

//         const popupContentWrapper = document.createElement("div");
//         popupContentWrapper.className = "jseed-custom-modal jseed-modal-up";

//         const tip = document.createElement("div");
//         tip.className = "jseed-modal-tip";
//         popupContentWrapper.appendChild(tip);

//         const closeBtn = document.createElement("button");
//         closeBtn.innerHTML = "✖";
//         closeBtn.style.cssText = `position: absolute; top: 12px; ${lang === "he" ? "left" : "right"}: 12px; background: none; border: none; color: #9ca3af; font-size: 16px; cursor: pointer; z-index: 20; padding: 4px;`;
//         closeBtn.onclick = (e) => {
//           e.stopPropagation();
//           activePopupRef.current?.remove();
//         };
//         popupContentWrapper.appendChild(closeBtn);

//         const innerContent = document.createElement("div");
//         innerContent.style.width = "100%";
//         popupContentWrapper.appendChild(innerContent);

//         const buildInnerContent = () => {
//           innerContent.innerHTML = "";
//           if (count === 1) {
//             const singlePoint = pointsInCat[0];
//             const isSaved = savedIds.includes(singlePoint.id);
//             innerContent.appendChild(createPopupNode(singlePoint, isSaved, map));
//           } else {
//             let currentIndex = 0;
//             const renderCurrentPoint = () => {
//               innerContent.innerHTML = "";
//               const currentPoint = pointsInCat[currentIndex];
//               const pId = Number(currentPoint.id);
//               const isSaved = savedIds.includes(currentPoint.id);

//               if (!globalClickedPoints.has(pId)) {
//                 persistViewedPoint(pId);
//                 fetch("/api/history", {
//                   method: "POST",
//                   headers: { "Content-Type": "application/json" },
//                   body: JSON.stringify({ pointId: pId }),
//                 }).catch(console.error);
//               }

//               const navBar = document.createElement("div");
//               navBar.style.display = "flex";
//               navBar.style.justifyContent = "space-between";
//               navBar.style.alignItems = "center";
//               navBar.style.backgroundColor = "rgba(251, 191, 36, 0.15)";
//               navBar.style.border = "1px solid rgba(251, 191, 36, 0.4)";
//               navBar.style.borderRadius = "12px";
//               navBar.style.padding = "6px 10px";
//               navBar.style.marginBottom = "10px";
//               navBar.dir = lang === "he" ? "rtl" : "ltr";

//               const createBtn = (html: string, onClick: () => void) => {
//                 const btn = document.createElement("button");
//                 btn.innerHTML = html;
//                 btn.style.background = "rgba(251, 191, 36, 0.2)";
//                 btn.style.border = "1px solid #fbbf24";
//                 btn.style.color = "#fbbf24";
//                 btn.style.borderRadius = "50%";
//                 btn.style.width = "26px";
//                 btn.style.height = "26px";
//                 btn.style.display = "flex";
//                 btn.style.alignItems = "center";
//                 btn.style.justifyContent = "center";
//                 btn.style.cursor = "pointer";
//                 btn.style.transition = "background 0.2s";
//                 btn.onmouseover = () =>
//                   (btn.style.background = "rgba(251, 191, 36, 0.4)");
//                 btn.onmouseout = () =>
//                   (btn.style.background = "rgba(251, 191, 36, 0.2)");
//                 btn.onclick = (e) => {
//                   e.stopPropagation();
//                   onClick();
//                 };
//                 return btn;
//               };

//               const prevBtn = createBtn(lang === "he" ? "❯" : "❮", () => {
//                 currentIndex = currentIndex > 0 ? currentIndex - 1 : count - 1;
//                 renderCurrentPoint();
//               });
//               const nextBtn = createBtn(lang === "he" ? "❮" : "❯", () => {
//                 currentIndex = currentIndex < count - 1 ? currentIndex + 1 : 0;
//                 renderCurrentPoint();
//               });
//               const label = document.createElement("span");
//               label.innerText =
//                 lang === "he"
//                   ? `נקודה ${currentIndex + 1} מתוך ${count}`
//                   : `Point ${currentIndex + 1} of ${count}`;
//               label.style.fontSize = "12px";
//               label.style.fontWeight = "bold";
//               label.style.color = "#fbbf24";

//               navBar.appendChild(prevBtn);
//               navBar.appendChild(label);
//               navBar.appendChild(nextBtn);

//               innerContent.appendChild(navBar);
//               innerContent.appendChild(
//                 createPopupNode(currentPoint, isSaved, map)
//               );
//             };
//             renderCurrentPoint();
//           }
//         };

//         const popup = new maptilersdk.Popup({
//           closeButton: false,
//           closeOnClick: true,
//           className: "headless-popup",
//           maxWidth: "none",
//         }).setDOMContent(popupContentWrapper);

//         const marker = new maptilersdk.Marker({
//           element: el,
//           anchor: "bottom",
//         })
//           .setLngLat([finalLng, finalLat])
//           .addTo(map);

//         const openModal = () => {
//           activePopupRef.current?.remove();

//           const pt = map.project([finalLng, finalLat]);
//           const containerRect = map.getContainer().getBoundingClientRect();
//           const mapWidth = containerRect.width;
//           const mapHeight = containerRect.height;

//           let direction = "up";
//           if (pt.y < mapHeight * 0.55) direction = "down";
//           if (pt.x > mapWidth * 0.65) direction = "left";
//           else if (pt.x < mapWidth * 0.35) direction = "right";

//           popupContentWrapper.className = `jseed-custom-modal jseed-modal-${direction}`;
//           buildInnerContent();

//           const currentZoom = map.getZoom();
//           if (count === 1) {
//             const pId = Number(pointsInCat[0].id);
//             if (!globalClickedPoints.has(pId)) {
//               persistViewedPoint(pId);
//               fetch("/api/history", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({ pointId: pId }),
//               }).catch(console.error);
//             }
//           }

//           updateGroupedIconElement(el, category, true, currentZoom, count);
//           popup.setLngLat([finalLng, finalLat]).addTo(map);
//           activePopupRef.current = popup;
//         };

//         el.addEventListener("click", (e) => {
//           e.stopPropagation();
//           openModal();
//         });

//         activeMarkersRef.current.push(marker);
//         pointsInCat.forEach((p) => {
//           markersByPointIdRef.current[p.id] = { marker, openModal };
//         });

//         markerUpdaters.push((zoom: number) => {
//           updateGroupedIconElement(
//             el,
//             category,
//             checkIsAnyViewed(),
//             zoom,
//             count
//           );
//         });
//       });
//     });

//     // 4. תמיכה בקישור ישיר לנקודה (?point=ID)
//     const urlParams = new URLSearchParams(window.location.search);
//     const pointIdFromUrl = urlParams.get("point");

//     if (pointIdFromUrl) {
//       const targetEntry = markersByPointIdRef.current[Number(pointIdFromUrl)];
//       const targetPoint = points.find((p) => p.id === Number(pointIdFromUrl));

//       if (targetEntry && targetPoint) {
//         map.flyTo({
//           center: [Number(targetPoint.longitude), Number(targetPoint.latitude)],
//           zoom: 16,
//           duration: 1500,
//         });
//         setTimeout(() => {
//           targetEntry.openModal();
//         }, 1600);
//         window.history.replaceState({}, "", window.location.pathname);
//       }
//     }

//     // 5. התאמת גודל האייקונים בזמן אמת כשעושים זום בגלובוס
//     const handleZoomEnd = () => {
//       const currentZoom = map.getZoom();
//       markerUpdaters.forEach((updateFn) => updateFn(currentZoom));
//     };

//     map.on("zoomend", handleZoomEnd);
//     return () => {
//       map.off("zoomend", handleZoomEnd);
//     };
//   }, [map, points, activeCategory, viewedIds, savedIds, lang, searchQuery]);

//   return { createPopupNode };
// }