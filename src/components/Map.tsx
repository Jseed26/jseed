"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useMapMarkers } from "@/src/hooks/useMapMarkers";
import { Point } from "@/src/types/point";
import { useSession } from "next-auth/react";
import PointForm from "@/src/components/PointForm";

type MapProps = {
  activeCategory: Point["category"] | null;
  isCompassMode: boolean;
  setCompassMode: (value: boolean) => void;
  searchQuery: string;
  isLoggedIn: boolean;
  lang: "he" | "en";
};

// 🌟 עדכנו את ה-ModalState שישמור גם את תוכן הטופס אם המשתמש חזר למפה כדי לבחור מיקום
type ModalState = {
  lat: number;
  lng: number;
  prefilledName?: string;
  prefilledCategory?: string;
  draftData?: any; // פה נשמור את המידע שהוא כבר הקליד
} | null;

const tMap = {
  loginRequired: { he: "צריך להתחבר כדי להוסיף גרעין", en: "Please log in to add a seed" },
  locationError: { he: "לא הצלחנו למצוא את המיקום שלך. ודא ששירותי המיקום (GPS) דולקים.", en: "Could not find your location. Please ensure GPS is enabled." },
  locationUnstable: { he: "שירות המיקום של המכשיר שלך לא יציב כרגע. אנא נסה שוב מאוחר יותר.", en: "Your device's location service is unstable. Please try again later." },
  locating: { he: "מאתר מיקום... אנא המתן לפני בחירת רדיוס.", en: "Locating... Please wait before selecting a radius." },
  noFilter: { he: "ללא סינון", en: "No filter" },
  upTo: { he: "עד", en: "Up to" },
  km: { he: "ק\"מ", en: "km" },
  zoomOut: { he: "זום אאוט למפה", en: "Zoom out" },
  myLocation: { he: "המיקום שלי", en: "My Location" },
  filterDist: { he: "סינון לפי מרחק", en: "Filter by distance" },
  locNotFound: { he: "המיקום שלך לא נקלט, האם להשתמש במיקום של המצפן במפה?", en: "Location not found. Use the compass location on the map?" },
  enterAddress: { he: "אנא הזן רחוב, מספר ועיר בלבד", en: "Please enter street, number, and city only" },
  noAddress: { he: "לא הזנת כתובת. האם לשמור את הנקודה לפי המיקום של המצפן במפה?", en: "No address entered. Save point using the compass location?" },
  thankYouMsg: { he: "תודה! הגרעין נוסף בהצלחה 🌱", en: "Thank you! Seed added successfully 🌱" },
  pickLocationMsg: { he: "לחץ על המפה כדי לבחור מיקום מדויק 📍", en: "Tap on the map to pick an exact location 📍" }, // 🌟 הודעה צפה בזמן בחירת מיקום
  cancelPick: { he: "ביטול חזרה למפה", en: "Cancel Picking" }
};

export default function Map({
  activeCategory,
  isCompassMode,
  searchQuery,
  setCompassMode,
  isLoggedIn,
  lang,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  const [map, setMap] = useState<L.Map | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  
  // 🌟 סטייט חדש שזוכר שאנחנו עכשיו "מצלפים" על המפה
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [draftFormState, setDraftFormState] = useState<any>(null); // שומר את הטופס בזמן שאנחנו על המפה

  const mapInstanceRef = useRef<L.Map | null>(null);

  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const [successToast, setSuccessToast] = useState<string | null>(null);

  const { status } = useSession();

  const [isFollowing, setIsFollowing] = useState(false);
  const [filterRadius, setFilterRadius] = useState<number | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [showRadiusMenu, setShowRadiusMenu] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    const container = mapRef.current;
    const isMobile = window.innerWidth < 768;

    const worldBounds = L.latLngBounds(
      [-90, -180],
      [90, 180]
    );

    const newMap = L.map(container, {
      center: [31.5, 10.8], 
      zoom: isMobile ? 2 : 2.5,
      minZoom: isMobile ? 2 : 2.5,
      maxZoom: 18,
      maxBounds: worldBounds,
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
      zoomControl: false,
      preferCanvas: true,
      zoomSnap: 0,
      zoomAnimation: false,
      markerZoomAnimation: false,
      fadeAnimation: false
    });

    mapInstanceRef.current = newMap;

    const maptilerLayer = L.tileLayer(
      "https://api.maptiler.com/maps/hybrid/256/{z}/{x}/{y}.jpg?key=1eZTTOxJLWMsKdfO1otY",
      {
        noWrap: true,
        bounds: worldBounds
      }
    );

    maptilerLayer.addTo(newMap);
    setMap(newMap);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/points");
      const data = await res.json();
      setPoints(Array.isArray(data) ? data : []);
    }
    load();
  }, []);

  const loadHistory = async () => {
      try {
        const res = await fetch("/api/history");
        if (res.ok) {
          const data = await res.json();
          setViewedIds(data.map((p: Point) => p.id));
        }
      } catch (err) { }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    loadHistory();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    async function loadSaved() {
      try {
        const res = await fetch("/api/saved");
        if (res.ok) {
          const data = await res.json();
          setSavedIds(data.map((p: Point) => p.id));
        }
      } catch (err) { }
    }

    loadSaved();
  }, [isLoggedIn]);

  useEffect(() => {
    async function search() {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("q", searchQuery);
      if (activeCategory) params.append("category", activeCategory);

      const res = await fetch(`/api/points?${params.toString()}`);
      const data = await res.json();
      setPoints(Array.isArray(data) ? data : []);
    }
    search();
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    const refresh = async () => {
      const res = await fetch("/api/points");
      const data = await res.json();
      setPoints(data);

      if (isLoggedIn) {
        const resSaved = await fetch("/api/saved");
        if (resSaved.ok) {
          const savedData = await resSaved.json();
          setSavedIds(savedData.map((p: Point) => p.id));
        }
        loadHistory();
      }
    };

    window.addEventListener("points-updated", refresh);
    return () => {
      window.removeEventListener("points-updated", refresh);
    };
  }, [isLoggedIn]);


  // 🌟 הלוגיקה של לחיצה על המפה עכשיו מנהלת גם את "מצב צלף" וגם את הוספת היוזמה הרגילה
  useEffect(() => {
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      
      // 🌟 אם אנחנו במצב בחירת מיקום
      if (isPickingLocation && draftFormState) {
          setModal({
              lat: e.latlng.lat,
              lng: e.latlng.lng,
              prefilledCategory: draftFormState.category,
              draftData: draftFormState, // מחזירים את הטופס כפי שהיה
          });
          setIsPickingLocation(false);
          setDraftFormState(null);
          return;
      }

      // התנהגות רגילה של הוספת גרעין עם פלוס (מצפן)
      if (!isCompassMode) return;

      if (!isLoggedIn) {
        alert(tMap.loginRequired[lang]);
        return;
      }

      setModal({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    };

    const handleLocationError = () => {
      setIsLocating(false);
      setIsFollowing(false);
      alert(tMap.locationError[lang]);
    };

    const handleLocationFound = (e: any) => {
      setIsLocating(false);

      if (e.latlng.lat === 0 && e.latlng.lng === 0) {
        setIsFollowing(false);
        setUserLocation(null);
        setFilterRadius(null);
        alert(tMap.locationUnstable[lang]);
        return;
      }

      setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      setIsFollowing(true);
    };

    const onMove = () => setIsFollowing(false);

    map.on("click", handleClick);
    map.on("locationerror", handleLocationError);
    map.on("locationfound", handleLocationFound);
    map.on("movestart", onMove);

    return () => {
      map.off("click", handleClick);
      map.off("locationerror", handleLocationError);
      map.off("locationfound", handleLocationFound);
      map.off("movestart", onMove);
    };
  }, [map, isCompassMode, activeCategory, isLoggedIn, lang, isPickingLocation, draftFormState]);

  useEffect(() => {
    const handleDirectAdd = (e: any) => {
      if (!isLoggedIn) {
        alert(tMap.loginRequired[lang]);
        return;
      }

      const center = mapInstanceRef.current?.getCenter() || { lat: 31.768, lng: 35.213 };

      setModal({
        lat: e.detail.lat || center.lat,
        lng: e.detail.lng || center.lng,
        prefilledName: e.detail.name,
        prefilledCategory: e.detail.category
      });
    };

    window.addEventListener("open-direct-add-form", handleDirectAdd);
    return () => window.removeEventListener("open-direct-add-form", handleDirectAdd);
  }, [isLoggedIn, lang]);

  const filteredPoints = useMemo(() => {
    if (!filterRadius || !userLocation || !map) return points;

    return points.filter((p) => {
      const distanceInMeters = map.distance(
        [Number(p.latitude), Number(p.longitude)],
        [userLocation.lat, userLocation.lng]
      );
      return distanceInMeters <= filterRadius * 1000;
    });
  }, [points, filterRadius, userLocation, map]);

  useEffect(() => {
    map?.eachLayer((layer: any) => {
      if (layer.options && (layer.options.dashArray === "5, 5" || layer.options.isUserLocationMarker)) {
        map.removeLayer(layer);
      }
    });

    if (!map || !userLocation) return;

    const userPinIcon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="rgba(17,24,39,0.9)" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="transform: translate(-50%, -100%); filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#fbbf24" stroke="none"/></svg>`,
      className: "",
      iconSize: [0, 0],
    });

    L.marker([userLocation.lat, userLocation.lng], {
      icon: userPinIcon,
      isUserLocationMarker: true
    } as any).addTo(map);

    if (filterRadius) {
      const circle = L.circle([userLocation.lat, userLocation.lng], {
        radius: filterRadius * 1000,
        color: '#FFD700',
        fillColor: '#FFD700',
        fillOpacity: 0.05,
        weight: 1.5,
        dashArray: "5, 5"
      }).addTo(map);
      map.fitBounds(circle.getBounds());
    }
  }, [map, userLocation, filterRadius]);

  useMapMarkers({
    map,
    points: filteredPoints,
    activeCategory,
    viewedIds,
    savedIds,
    lang,
    searchQuery,
  });

  return (
    <div className={`relative w-full h-full ${isPickingLocation ? 'cursor-crosshair' : ''}`}>
      <div
        ref={mapRef}
        className="w-full h-full min-h-[50vh] rounded-2xl overflow-hidden bg-black relative"
      />

      {isCompassMode && !isPickingLocation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400] pb-8">
          <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="rgba(17,24,39,0.9)" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.3))" }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" fill="#fbbf24" stroke="none" />
          </svg>
        </div>
      )}

      {/* 🌟 משימה 1: קומפוננטת פופאפ הודעת התודה */}
      {successToast && (
        <div className="absolute inset-0 z-[99999] pointer-events-none flex items-center justify-center">
          <div className="bg-gray-900 border border-yellow-500 text-yellow-500 font-bold px-6 py-4 rounded-xl shadow-2xl animate-bounce">
            {successToast}
          </div>
        </div>
      )}

      {/* 🌟 ממשק צף לבחירת מיקום על המפה! */}
      {isPickingLocation && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[400] flex flex-col items-center gap-2 pointer-events-auto">
              <div className="bg-gray-900/90 backdrop-blur-sm border border-yellow-500 text-yellow-500 font-bold px-6 py-3 rounded-full shadow-2xl animate-pulse whitespace-nowrap text-sm sm:text-base">
                {tMap.pickLocationMsg[lang]}
              </div>
              <button 
                  onClick={() => {
                      setIsPickingLocation(false);
                      // שחזור הטופס ללא שינוי במיקום
                      setModal({
                          lat: draftFormState.lat || 31.768,
                          lng: draftFormState.lng || 35.213,
                          draftData: draftFormState
                      });
                  }}
                  className="bg-red-900/80 hover:bg-red-800 border border-red-500 text-red-200 px-4 py-1.5 rounded-full text-xs font-bold transition shadow-lg"
              >
                  ✕ {tMap.cancelPick[lang]}
              </button>
          </div>
      )}

      {modal && !isPickingLocation && (
        <PointForm
          mode="create"
          category={modal.prefilledCategory || activeCategory}
          initialData={{
            lat: modal.lat,
            lng: modal.lng,
            name: modal.draftData?.name || modal.prefilledName,
            description: modal.draftData?.description,
            // 🌟 אם הוא חזר מצליפה על המפה, נמלא לו אוטומטית הודעה יפה בשדה הכתובת
            address: modal.draftData ? (lang === "he" ? "מיקום נבחר מהמפה 📍" : "Location picked from map 📍") : modal.draftData?.address,
            website: modal.draftData?.website,
            images: modal.draftData?.images,
            existingImages: modal.draftData?.existingImages
          }}
          onClose={() => setModal(null)}
          onPickLocation={(currentFormState) => {
              setDraftFormState({
                  ...currentFormState,
                  lat: modal.lat, 
                  lng: modal.lng,
                  // כשאנחנו יוצאים לצלף, ננקה את הכתובת כדי שנוכל למלא אותה בחזרה מהמפה
                  address: "" 
              });
              setModal(null);
              setIsPickingLocation(true);
          }}
          onSubmit={async ({ form }) => {
            if (status !== "authenticated") return;

            let finalLat = modal.lat;
            let finalLng = modal.lng;

            const cleanAddress = form.address ? form.address.trim() : "";

            // 🌟 אם הכתובת היא ההודעה האוטומטית שלנו שמעידה שהוא צלף, או אם יש לנו דראפט (שזה אומר שהוא עשה צליפה) 
            // אנחנו מדלגים על חיפוש הכתובת ושומרים ישר!
            const isPickedFromMap = modal.draftData !== undefined || cleanAddress.includes("📍");

            if (!isPickedFromMap && cleanAddress !== "") {
              try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1`);
                const geoData = await geoRes.json();

                if (geoData && geoData.length > 0) {
                  finalLat = parseFloat(geoData[0].lat);
                  finalLng = parseFloat(geoData[0].lon);
                } else {
                  const useCompass = window.confirm(tMap.locNotFound[lang]);
                  if (!useCompass) {
                    alert(tMap.enterAddress[lang]);
                    return;
                  }
                }
              } catch (err) { }
            } else if (!isPickedFromMap) {
              const useCompass = window.confirm(tMap.noAddress[lang]);
              if (!useCompass) {
                alert(tMap.enterAddress[lang]);
                return;
              }
            }

            const formData = new FormData();
            formData.append("name", form.name);
            formData.append("description", form.description);
            // אם זו ההודעה האוטומטית, נשמור כתובת ריקה במסד נתונים כדי שלא יראה למשתמשים את הטקסט "מיקום נבחר מהמפה" ככתובת אמיתית
            formData.append("address", isPickedFromMap ? "" : cleanAddress);
            formData.append("website", form.website);
            formData.append("category", form.category);
            formData.append("latitude", String(finalLat));
            formData.append("longitude", String(finalLng));

            if (form.images && form.images.length > 0) {
              form.images.forEach((img) => {
                formData.append("images", img);
              });
            }

            
            const res = await fetch("/api/points", {
              method: "POST",
              body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
              alert(data.error);
              return;
            }

            setPoints((prev) => [...prev, data]);
            setModal(null);
            setCompassMode(false);
            setDraftFormState(null); // 🌟 חשוב לנקות את הזיכרון אחרי שמירה מוצלחת

            setViewedIds((prev) => [...prev, data.id]);

            if (map) {
              map.setView([finalLat, finalLng], 16);
            }

            setSuccessToast(tMap.thankYouMsg[lang]);
            setTimeout(() => {
              setSuccessToast(null);
            }, 3000); 
          }}
        />
      )}

      {/* GPS Button */}
      <button
        onClick={() => {
          if (!map) return;
          if (isLocating) return;

          if (isFollowing) {
            map.setView([31.7683, 35.2137], 3);
            setIsFollowing(false);
          } else {
            setIsLocating(true);
            map.locate({
              setView: true,
              maxZoom: 16,
              enableHighAccuracy: true
            });
          }
        }}
        className={`absolute bottom-6 left-[24px] z-[400] border p-2 rounded-full shadow-lg transition-colors ${isLocating ? "bg-gray-800 border-yellow-500 cursor-wait" : "bg-gray-900 border-gray-700 hover:bg-gray-800"}`}
        title={isFollowing ? tMap.zoomOut[lang] : tMap.myLocation[lang]}
      >
        {isLocating ? (
          <svg className="animate-spin h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : isFollowing ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 11l19-9-9 19-2-8-8-2z" />
          </svg>
        )}
      </button>

      {/* Radius Menu */}
      <div className="absolute bottom-6 left-[68px] z-[400] flex flex-col-reverse items-start gap-2">
        <button
          onClick={() => {
            if (!userLocation && map) {
              if (!isLocating) {
                setIsLocating(true);
                map.locate({ enableHighAccuracy: true });
              }
              alert(tMap.locating[lang]);
              return;
            }
            setShowRadiusMenu(!showRadiusMenu);
          }}
          className={`p-2 rounded-full shadow-lg transition-colors border ${filterRadius
            ? "bg-yellow-500 border-yellow-400 text-black"
            : "bg-gray-900 border-gray-700 text-yellow-500 hover:bg-gray-800"
            }`}
          title={tMap.filterDist[lang]}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {showRadiusMenu && userLocation && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl flex flex-col p-1 w-32 max-h-60 overflow-y-auto custom-scrollbar">
            <button
              onClick={() => { setFilterRadius(null); setShowRadiusMenu(false); }}
              className={`text-center px-3 py-2 text-sm rounded-lg hover:bg-gray-800 ${!filterRadius ? "text-yellow-400 font-bold" : "text-gray-300"}`}
            >
              {tMap.noFilter[lang]}
            </button>

            {Array.from({ length: 10 }, (_, i) => (i + 1) * 5).map((dist) => (
              <button
                key={dist}
                onClick={() => { setFilterRadius(dist); setShowRadiusMenu(false); }}
                className={`text-center px-3 py-2 text-sm rounded-lg hover:bg-gray-800 ${filterRadius === dist ? "text-yellow-400 font-bold bg-gray-800" : "text-gray-300"}`}
              >
                {tMap.upTo[lang]} {dist} {tMap.km[lang]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div >
  );
}