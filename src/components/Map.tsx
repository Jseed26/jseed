"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";

import { useMapMarkers } from "@/src/hooks/useMapMarkers";
import { Point } from "@/src/types/point";
import { useSession } from "next-auth/react";
import PointForm from "@/src/components/PointForm";
import { useRouter, useSearchParams } from "next/navigation";

type MapProps = {
  activeCategory: Point["category"] | null;
  isCompassMode: boolean;
  setCompassMode: (value: boolean) => void;
  searchQuery: string;
  isLoggedIn: boolean;
  lang: "he" | "en";
};

type ModalState = {
  lat: number;
  lng: number;
  prefilledName?: string;
  prefilledCategory?: string;
  draftData?: any;
  parentId?: number | null;
  mode?: "create" | "edit"; 
  pointId?: number; 
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
  editSuccess: { he: "הגרעין עודכן בהצלחה! 🔄", en: "Seed updated successfully! 🔄" },
  pickLocationMsg: { he: "לחץ על המפה כדי לבחור מיקום מדויק 📍", en: "Tap on the map to pick an exact location 📍" },
  cancelPick: { he: "ביטול חזרה", en: "Cancel Picking" },
  gpsDisabled: { he: "שירותי המיקום כבויים. ניתן להדליקם בהגדרות ב'אזור שלי'.", en: "Location services are disabled in settings." },
  suggestionsTitle: { he: "SEEDS", en: "SEEDS" },
  loadingSuggestions: { he: "טוען רעיונות...", en: "Loading ideas..." },
  noSuggestions: { he: "לא מצאנו הצעות כרגע", en: "No suggestions right now" },
  backToList: { he: "חזרה להצעות", en: "Back to list" },
  takeMeThere: { he: "קח אותי לנקודה", en: "Take me to point" }
};

type DrawerMode = 'peek' | 'closed' | 'open';

// פונקציית עזר לחישוב מרחק בקילומטרים בין שתי קואורדינטות (Haversine)
function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// פונקציית עזר ליצירת פוליגון מעגל עבור הגלובוס
function createGeoJSONCircle(center: [number, number], radiusInKm: number, points = 64) {
  const [lng, lat] = center;
  const coords = [];
  const distanceX = radiusInKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInKm / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]);

  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [coords],
    },
    properties: {},
  };
}

export default function Map({
  activeCategory,
  isCompassMode,
  searchQuery,
  setCompassMode,
  isLoggedIn,
  lang,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [map, setMap] = useState<maptilersdk.Map | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [draftFormState, setDraftFormState] = useState<any>(null);

  const mapInstanceRef = useRef<maptilersdk.Map | null>(null);
  const userMarkerRef = useRef<maptilersdk.Marker | null>(null);

  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const { status } = useSession();

  const [isFollowing, setIsFollowing] = useState(false);
  const [filterRadius, setFilterRadius] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [showRadiusMenu, setShowRadiusMenu] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [showLocationMarker, setShowLocationMarker] = useState(false);

  const [drawerMode, setDrawerMode] = useState<DrawerMode>('peek');
  const [hasStarted, setHasStarted] = useState(false);
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null); 
  const suggestionNodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkGps = () => setGpsEnabled(localStorage.getItem("jseed_gps_disabled") !== "true");
    checkGps();
    window.addEventListener("gps-setting-changed", checkGps);
    return () => window.removeEventListener("gps-setting-changed", checkGps);
  }, []);

  useEffect(() => {
    if (!gpsEnabled) {
      setIsFollowing(false);
      setShowLocationMarker(false);
      setUserLocation(null);
      setFilterRadius(null);
    }
  }, [gpsEnabled]);

  useEffect(() => {
    const action = searchParams.get("action");
    const editPointId = searchParams.get("editPoint");

    if (action === "pick_location" && editPointId) {
      const draftJson = localStorage.getItem("jseed_edit_draft");
      if (draftJson) {
        try {
          const parsed = JSON.parse(draftJson);
          if (parsed.pointId.toString() === editPointId) {
            setDraftFormState({ ...parsed.form, editPointId: parsed.pointId });
            setIsPickingLocation(true);
            router.replace('/', { scroll: false });
          }
        } catch (e) {}
      }
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isStarted = sessionStorage.getItem("jseed_app_started") === "true";
      if (isStarted) {
        setHasStarted(true);
        setDrawerMode('closed');
      } else {
        setIsLoadingSuggestions(true);
        fetch("/api/suggestions")
          .then(res => res.json())
          .then(data => setSuggestions(data))
          .catch(console.error)
          .finally(() => setIsLoadingSuggestions(false));
      }
    }
  }, []);

  // 🌟 אתחול הגלובוס התלת-ממדי של MapTiler
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    const container = mapRef.current;
    const isMobile = window.innerWidth < 768;

    maptilersdk.config.apiKey = "1eZTTOxJLWMsKdfO1otY";

    const newMap = new maptilersdk.Map({
      container,
      style: "019f76f1-2bdd-7600-aefe-ed6362e87df7",
      center: [20, 25], // [lng, lat] - ממורכז על אירופה/אפריקה/אסיה כמו בתמונה
      zoom: isMobile ? 0.8 : 1.3, // זום אאוט שמציג את כל הגלובוס העגול בחלל
      minZoom: 0.5,
      maxZoom: 18,
      projection: "globe", // 🌍 מפעיל את הגלובוס התלת-ממדי!
      navigationControl: false,
      geolocateControl: false,
    });

    mapInstanceRef.current = newMap;

    newMap.on("load", () => {
      // מוודאים שגם אם הסטייל שטוח, ההקרנה תהיה גלובוס תלת-ממדי
      newMap.setProjection({ type: "globe" });
      setMap(newMap);

      if (typeof window !== "undefined" && sessionStorage.getItem("jseed_app_started") === "true") {
        fetch("https://ipapi.co/json/")
          .then(res => res.json())
          .then(data => {
            if (data && data.latitude && data.longitude) {
              newMap.jumpTo({ center: [data.longitude, data.latitude], zoom: 6 });
            }
          })
          .catch(() => {});
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        setViewedIds(data.map((p: Point) => p.id));
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    loadHistory();
    async function loadSaved() {
      try {
        const res = await fetch("/api/saved");
        if (res.ok) {
          const data = await res.json();
          setSavedIds(data.map((p: Point) => p.id));
        }
      } catch (err) {}
    }
    loadSaved();
  }, [isLoggedIn]);

  useEffect(() => {
    async function search() {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("q", searchQuery);
      if (activeCategory) params.append("category", activeCategory);

      const res = await fetch(`/api/points?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setPoints(Array.isArray(data) ? data : []);
    }
    search();
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    const refresh = async () => {
      const res = await fetch("/api/points", { cache: "no-store" });
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
    return () => window.removeEventListener("points-updated", refresh);
  }, [isLoggedIn]);

  const startUserJourney = () => {
    setHasStarted(true);
    setDrawerMode('closed');
    if (typeof window !== "undefined") {
      sessionStorage.setItem("jseed_app_started", "true");
    }
    
    if (mapInstanceRef.current) {
      fetch("https://ipapi.co/json/")
        .then(res => res.json())
        .then(data => {
          if (data && data.latitude && data.longitude && mapInstanceRef.current) {
            mapInstanceRef.current.flyTo({
              center: [data.longitude, data.latitude],
              zoom: 6,
              duration: 2500,
              essential: true
            });
          }
        })
        .catch(() => console.log("Auto-zoom to country skipped."));
    }
  };

  // פונקציה לאיתור מיקום ה-GPS של המשתמש
  const locateUser = (flyToLocation: boolean) => {
    if (!navigator.geolocation) {
      alert(tMap.locationError[lang]);
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (latitude === 0 && longitude === 0) {
          setIsFollowing(false);
          setShowLocationMarker(false);
          setUserLocation(null);
          setFilterRadius(null);
          alert(tMap.locationUnstable[lang]);
          return;
        }
        setUserLocation({ lat: latitude, lng: longitude });
        setIsFollowing(true);
        setShowLocationMarker(true);
        if (flyToLocation && mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1800
          });
        }
      },
      () => {
        setIsLocating(false);
        setIsFollowing(false);
        setShowLocationMarker(false);
        alert(tMap.locationError[lang]);
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (!map) return;

    const handleClick = (e: maptilersdk.MapMouseEvent) => {
      if (!hasStarted) {
        startUserJourney();
        return; 
      }

      if (drawerMode === 'open') {
        setDrawerMode('closed');
        return;
      }

      if (isPickingLocation && draftFormState) {
        setModal({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          prefilledCategory: draftFormState.category,
          draftData: draftFormState,
          parentId: draftFormState.parentId,
          mode: draftFormState.editPointId ? "edit" : "create",
          pointId: draftFormState.editPointId
        });
        setIsPickingLocation(false);
        setDraftFormState(null);
        return;
      }

      if (!isCompassMode) return;
      if (!isLoggedIn) {
        alert(tMap.loginRequired[lang]);
        return;
      }

      setModal({ lat: e.lngLat.lat, lng: e.lngLat.lng, mode: "create" });
    };

    const onDragStart = () => setIsFollowing(false);

    map.on("click", handleClick);
    map.on("dragstart", onDragStart);

    return () => {
      map.off("click", handleClick);
      map.off("dragstart", onDragStart);
    };
  }, [map, isCompassMode, activeCategory, isLoggedIn, lang, isPickingLocation, draftFormState, hasStarted, drawerMode]);

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
        prefilledCategory: e.detail.category,
        parentId: e.detail.parentId,
        mode: "create"
      });
    };

    window.addEventListener("open-direct-add-form", handleDirectAdd);
    return () => window.removeEventListener("open-direct-add-form", handleDirectAdd);
  }, [isLoggedIn, lang]);

  const filteredPoints = useMemo(() => {
    if (!filterRadius || !userLocation) return points;
    return points.filter((p) => {
      const distKm = getDistanceInKm(
        Number(p.latitude),
        Number(p.longitude),
        userLocation.lat,
        userLocation.lng
      );
      return distKm <= filterRadius;
    });
  }, [points, filterRadius, userLocation]);

  // ציור מיקום המשתמש ומעגל הרדיוס על גבי הגלובוס
  useEffect(() => {
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (map.getLayer("radius-fill")) map.removeLayer("radius-fill");
    if (map.getLayer("radius-outline")) map.removeLayer("radius-outline");
    if (map.getSource("radius-source")) map.removeSource("radius-source");

    if (!userLocation || !showLocationMarker) return;

    const el = document.createElement("div");
    el.innerHTML = `
      <div style="position: relative; width: 14px; height: 14px;">
        <div style="position: absolute; top: -60%; left: -60%; width: 220%; height: 220%; background-color: rgba(251, 191, 36, 0.25); border-radius: 50%; z-index: 1;"></div>
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: #fbbf24; border: 2px solid #111827; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.4); z-index: 2;"></div>
      </div>
    `;

    userMarkerRef.current = new maptilersdk.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);

    if (filterRadius) {
      const circleGeoJSON = createGeoJSONCircle([userLocation.lng, userLocation.lat], filterRadius);
      map.addSource("radius-source", {
        type: "geojson",
        data: circleGeoJSON,
      });

      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius-source",
        paint: {
          "fill-color": "#FFD700",
          "fill-opacity": 0.06,
        },
      });

      map.addLayer({
        id: "radius-outline",
        type: "line",
        source: "radius-source",
        paint: {
          "line-color": "#FFD700",
          "line-width": 1.5,
          "line-dasharray": [4, 4],
        },
      });
    }
  }, [map, userLocation, filterRadius, showLocationMarker]);

  const { createPopupNode } = useMapMarkers({
    map: map as any,
    points: filteredPoints,
    activeCategory,
    viewedIds,
    savedIds,
    lang,
    searchQuery,
  });

  const handleSuggestionClick = (point: any) => {
    if (!hasStarted) {
      startUserJourney();
      setDrawerMode('open');
    }
    setSelectedSuggestion(point);
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pointId: point.id }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (selectedSuggestion && suggestionNodeRef.current && map) {
      const isSaved = savedIds.includes(selectedSuggestion.id);
      const node = createPopupNode(selectedSuggestion, isSaved, map as any);
      suggestionNodeRef.current.innerHTML = "";
      suggestionNodeRef.current.appendChild(node);
    }
  }, [selectedSuggestion, savedIds, map, createPopupNode]);

  const isHe = lang === 'he';

  const drawerWidthClass = drawerMode === 'peek' 
    ? "w-[20%] md:w-[30%]" 
    : "w-[95%] md:w-[65%]";
  
  let drawerTransform = "translateX(0)";
  if (drawerMode === 'closed') {
    drawerTransform = isHe ? "translateX(100%)" : "translateX(-100%)";
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${isPickingLocation ? 'cursor-crosshair' : ''}`}>
      
      <div className="absolute inset-0 z-0">
        <div ref={mapRef} className="w-full h-full min-h-[50vh] bg-black relative" />
      </div>

      <div className="absolute inset-0 z-[400] pointer-events-none">
        
        {isCompassMode && !isPickingLocation && (
          <div className="absolute inset-0 flex items-center justify-center pb-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="rgba(17,24,39,0.9)" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.3))" }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" fill="#fbbf24" stroke="none" />
            </svg>
          </div>
        )}

        {successToast && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gray-900 border border-yellow-500 text-yellow-500 font-bold px-6 py-4 rounded-xl shadow-2xl animate-bounce text-center mx-4">
              {successToast}
            </div>
          </div>
        )}

        {isPickingLocation && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto">
            <div className="bg-gray-900/90 backdrop-blur-sm border border-yellow-500 text-yellow-500 font-bold px-6 py-3 rounded-full shadow-2xl animate-pulse whitespace-nowrap text-sm sm:text-base">
              {tMap.pickLocationMsg[lang]}
            </div>
            <button 
              onClick={() => {
                setIsPickingLocation(false);
                setModal({
                  lat: draftFormState.lat || 31.768,
                  lng: draftFormState.lng || 35.213,
                  draftData: draftFormState,
                  parentId: draftFormState.parentId,
                  mode: draftFormState.editPointId ? "edit" : "create",
                  pointId: draftFormState.editPointId
                });
              }}
              className="bg-red-900/80 hover:bg-red-800 border border-red-500 text-red-200 px-4 py-1.5 rounded-full text-xs font-bold transition shadow-lg"
            >
              ✕ {tMap.cancelPick[lang]}
            </button>
          </div>
        )}

        {modal && !isPickingLocation && (
          <div className="pointer-events-auto">
            <PointForm
              mode={modal.mode || "create"}
              category={modal.prefilledCategory || activeCategory}
              initialData={{
                lat: modal.lat,
                lng: modal.lng,
                name: modal.draftData?.name || modal.prefilledName,
                description: modal.draftData?.description,
                address: modal.draftData ? (lang === "he" ? "מיקום נבחר מהמפה 📍" : "Location picked from map 📍") : modal.draftData?.address,
                website: modal.draftData?.website,
                images: modal.draftData?.images,
                existingImages: modal.draftData?.existingImages,
                parentId: modal.parentId || modal.draftData?.parentId 
              }}
              onClose={() => {
                setModal(null);
                if (modal.mode === "edit") router.push("/my-points");
              }}
              onPickLocation={(currentFormState) => {
                setDraftFormState({
                  ...currentFormState,
                  lat: modal.lat, 
                  lng: modal.lng,
                  address: "", 
                  parentId: modal.parentId,
                  editPointId: modal.pointId
                });
                setModal(null);
                setIsPickingLocation(true);
              }}
              onSubmit={async ({ form }) => {
                if (status !== "authenticated") return;

                let finalLat = modal.lat;
                let finalLng = modal.lng;

                const cleanAddress = form.address ? form.address.trim() : "";
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
                  } catch (err) {}
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
                formData.append("address", isPickedFromMap ? "" : cleanAddress);
                formData.append("website", form.website);
                formData.append("category", form.category);
                formData.append("latitude", String(finalLat));
                formData.append("longitude", String(finalLng));

                if (form.parentId) formData.append("parentId", String(form.parentId));

                if (form.images && form.images.length > 0) {
                  form.images.forEach((img) => formData.append("images", img));
                }

                const isEditing = modal.mode === "edit";
                if (isEditing && form.existingImages && form.existingImages.length > 0) {
                  form.existingImages.forEach(url => formData.append("existingImages", url));
                }

                const endpoint = isEditing ? `/api/points/${modal.pointId}` : "/api/points";
                const method = isEditing ? "PUT" : "POST";

                const res = await fetch(endpoint, { method, body: formData });
                const data = await res.json();

                if (!res.ok) {
                  alert(data.error);
                  return;
                }

                setModal(null);
                setCompassMode(false);
                setDraftFormState(null);

                if (isEditing) {
                  window.dispatchEvent(new Event("points-updated"));
                  localStorage.removeItem("jseed_edit_draft"); 
                  router.push("/my-points"); 
                } else {
                  setPoints((prev) => [...prev, data]);
                  setViewedIds((prev) => [...prev, data.id]);
                  if (map) map.flyTo({ center: [finalLng, finalLat], zoom: 16 });
                  
                  setSuccessToast(tMap.thankYouMsg[lang]);
                  setTimeout(() => setSuccessToast(null), 3000); 
                }
              }}
            />
          </div>
        )}

        {hasStarted && (
          <div className="pointer-events-auto">
            <button
              onClick={() => {
                if (!map) return;
                if (!gpsEnabled) {
                  alert(tMap.gpsDisabled[lang]);
                  return;
                }
                if (isLocating) return;

                if (isFollowing) {
                  map.flyTo({ center: [20, 25], zoom: 1.2 });
                  setIsFollowing(false);
                  setShowLocationMarker(false);
                } else {
                  locateUser(true);
                }
              }}
              className={`absolute bottom-6 left-[24px] border p-2 rounded-full shadow-lg transition-colors ${!gpsEnabled ? "bg-gray-800 border-gray-600 opacity-60" : isLocating ? "bg-gray-800 border-yellow-500 cursor-wait" : "bg-gray-900 border-gray-700 hover:bg-gray-800"}`}
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

            <div className="absolute bottom-6 left-[68px] flex flex-col-reverse items-start gap-2">
              <button
                onClick={() => {
                  if (!gpsEnabled) {
                    alert(tMap.gpsDisabled[lang]);
                    return;
                  }
                  if (!userLocation) {
                    if (!isLocating) {
                      locateUser(false);
                    }
                    alert(tMap.locating[lang]);
                    return;
                  }
                  setShowRadiusMenu(!showRadiusMenu);
                }}
                className={`p-2 rounded-full shadow-lg transition-colors border ${!gpsEnabled ? "bg-gray-800 border-gray-600 opacity-60 text-gray-500" : filterRadius
                  ? "bg-yellow-500 border-yellow-400 text-black"
                  : "bg-gray-900 border-gray-700 text-yellow-500 hover:bg-gray-800"
                  }`}
                title={tMap.filterDist[lang]}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {showRadiusMenu && userLocation && gpsEnabled && (
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
                      onClick={() => { 
                        setFilterRadius(dist); 
                        setShowRadiusMenu(false);
                        setShowLocationMarker(true);
                      }}
                      className={`text-center px-3 py-2 text-sm rounded-lg hover:bg-gray-800 ${filterRadius === dist ? "text-yellow-400 font-bold bg-gray-800" : "text-gray-300"}`}
                    >
                      {tMap.upTo[lang]} {dist} {tMap.km[lang]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div 
        className={`absolute top-0 bottom-0 z-[500] flex ${isHe ? 'right-0' : 'left-0'} ${drawerWidthClass} transition-all duration-500 ease-in-out pointer-events-none`}
        style={{ transform: drawerTransform }}
      >
        <div dir={isHe ? 'rtl' : 'ltr'} className={`w-full h-full bg-gray-900/95 backdrop-blur-xl shadow-2xl flex flex-col pointer-events-auto relative border-${isHe ? 'l' : 'r'} border-gray-700/50`}>

          <div className="flex flex-col h-full">
            {!selectedSuggestion ? (
              <>
                <div className="flex justify-between items-center p-5 border-b border-gray-700/50 bg-gray-800/80 shrink-0">
                  <h3 className="text-yellow-500 font-bold text-xl">{tMap.suggestionsTitle[lang]}</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {isLoadingSuggestions ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                      <p className="font-medium">{tMap.loadingSuggestions[lang]}</p>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center px-4">
                      <p className="font-medium">{tMap.noSuggestions[lang]}</p>
                    </div>
                  ) : (
                    <div className={`grid gap-6 ${drawerMode === 'peek' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                      {suggestions.map((point) => {
                        const pointName = isHe ? point.name : (point.name_en || point.name);
                        const pointDesc = isHe ? point.description : (point.description_en || point.description);
                        const hasImage = point.imageUrls && point.imageUrls.length > 0;

                        return (
                          <div 
                            key={point.id} 
                            onClick={() => handleSuggestionClick(point)}
                            className="group relative flex flex-col bg-gray-800/80 rounded-[28px] overflow-hidden cursor-pointer border border-gray-700/50 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:-translate-y-1"
                          >
                            <div className={`w-full ${hasImage ? 'h-[45vh] md:h-52' : 'h-32'} bg-gray-950 relative shrink-0`}>
                              {hasImage ? (
                                <img src={point.imageUrls[0]} alt={pointName} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                  <img src={`/icons/categories/${point.category}/active.png`} alt={point.category} className="w-12 h-12 object-contain opacity-40 group-hover:opacity-60 transition-opacity" />
                                </div>
                              )}
                            </div>

                            <div className="p-5 flex flex-col gap-2">
                              <h4 className="text-xl font-bold text-white line-clamp-2 leading-tight">{pointName}</h4>
                              {pointDesc && (
                                <p className="text-base text-gray-300 line-clamp-3 mt-1 leading-relaxed">
                                  {pointDesc}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col h-full bg-gray-900 overflow-hidden">
                <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-gray-800/90 backdrop-blur-md border-b border-gray-700 shadow-md shrink-0">
                  <button 
                    onClick={() => setSelectedSuggestion(null)}
                    className="flex items-center gap-2 text-yellow-500 font-bold hover:text-yellow-400 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isHe ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
                    </svg>
                    {tMap.backToList[lang]}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pb-8">
                  <div 
                    ref={suggestionNodeRef} 
                    className="bg-[#111827] border border-gray-700 rounded-2xl p-4 shadow-2xl relative"
                  ></div>

                  <div className="flex justify-center mt-5 mb-2">
                    <button 
                      onClick={() => {
                        if (!hasStarted) {
                          setHasStarted(true);
                        }
                        setDrawerMode('closed');
                        setTimeout(() => setSelectedSuggestion(null), 300);
                        if (map) {
                          map.flyTo({
                            center: [Number(selectedSuggestion.longitude), Number(selectedSuggestion.latitude)],
                            zoom: 16
                          });
                        }
                        router.push(`/?point=${selectedSuggestion.id}`, { scroll: false });
                      }}
                      className="flex items-center gap-2 text-yellow-500 font-bold text-sm hover:text-yellow-400 hover:underline underline-offset-4 transition-all"
                    >
                      📍 {tMap.takeMeThere[lang]}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div 
          onClick={() => {
            if (drawerMode === 'closed' || drawerMode === 'peek') {
              setDrawerMode('open');
              if (!hasStarted) startUserJourney();
            }
            else setDrawerMode('closed');
          }}
          className={`absolute top-1/2 -translate-y-1/2 ${isHe ? 'left-[-20px]' : 'right-[-20px]'} w-5 h-20 bg-yellow-500 cursor-pointer pointer-events-auto shadow-lg flex items-center justify-center border border-yellow-400 ${isHe ? 'rounded-l-lg border-r-0' : 'rounded-r-lg border-l-0'} hover:bg-yellow-400 transition-colors z-[501]`}
        >
          <div className={`flex flex-col gap-1 ${isHe ? 'mr-0.5' : 'ml-0.5'}`}>
            <div className="w-1 h-1 bg-black/60 rounded-full"></div>
            <div className="w-1 h-1 bg-black/60 rounded-full"></div>
            <div className="w-1 h-1 bg-black/60 rounded-full"></div>
          </div>
        </div>
      </div>
      
    </div>
  );
}