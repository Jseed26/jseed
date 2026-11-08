"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


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

  const [map, setMap] = useState<L.Map | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [draftFormState, setDraftFormState] = useState<any>(null);

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
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [showLocationMarker, setShowLocationMarker] = useState(false);

  // 🌟 סטייט למגירה - מתחיל כרגיל פתוח למחצה (peek)
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

  // 🌟 לוגיקת SessionStorage חכמה! נטענת פעם אחת בלבד 
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isStarted = sessionStorage.getItem("jseed_app_started") === "true";
      if (isStarted) {
        // אם חזרנו לדף - סוגרים את המגירה ורושמים שהתחלנו
        setHasStarted(true);
        setDrawerMode('closed');
      } else {
        // אם זו הפעם הראשונה אי פעם - נמשוך רעיונות כדי להציג מיד ב-peek!
        setIsLoadingSuggestions(true);
        fetch("/api/suggestions")
          .then(res => res.json())
          .then(data => setSuggestions(data))
          .catch(console.error)
          .finally(() => setIsLoadingSuggestions(false));
      }
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    const container = mapRef.current;
    const isMobile = window.innerWidth < 768;
    const worldBounds = L.latLngBounds([-90, -180], [90, 180]);

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
      { noWrap: true, bounds: worldBounds }
    );

    maptilerLayer.addTo(newMap);
    setMap(newMap);

    // 🌟 אם חזרנו לדף (כבר התחלנו), נמקד את המפה ישר במדינה בלי "לטוס" לאט!
    if (typeof window !== "undefined" && sessionStorage.getItem("jseed_app_started") === "true") {
      fetch("https://ipapi.co/json/")
        .then(res => res.json())
        .then(data => {
          if (data && data.latitude && data.longitude) {
            newMap.setView([data.latitude, data.longitude], 6);
          }
        })
        .catch(() => {});
    }

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
      } catch (err) { }
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
      } catch (err) { }
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

  // 🌟 מתחיל את המסע ושומר ב-SessionStorage כדי שלא יקפוץ שוב בעתיד!
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
            mapInstanceRef.current.flyTo([data.latitude, data.longitude], 6, {
              duration: 2.5,
              easeLinearity: 0.25
            });
          }
        })
        .catch(() => console.log("Auto-zoom to country skipped."));
    }
  };

  useEffect(() => {
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
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
              lat: e.latlng.lat,
              lng: e.latlng.lng,
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

      setModal({ lat: e.latlng.lat, lng: e.latlng.lng, mode: "create" });
    };

    const handleLocationError = () => {
      setIsLocating(false);
      setIsFollowing(false);
      setShowLocationMarker(false);
      alert(tMap.locationError[lang]);
    };

    const handleLocationFound = (e: any) => {
      setIsLocating(false);
      if (e.latlng.lat === 0 && e.latlng.lng === 0) {
        setIsFollowing(false);
        setShowLocationMarker(false);
        setUserLocation(null);
        setFilterRadius(null);
        alert(tMap.locationUnstable[lang]);
        return;
      }
      setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      setIsFollowing(true);
      setShowLocationMarker(true);
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

    if (!map || !userLocation || !showLocationMarker) return;

    const userPinIcon = L.divIcon({
      html: `
        <div style="position: relative; width: 14px; height: 14px; transform: translate(-50%, -50%);">
          <div style="position: absolute; top: -60%; left: -60%; width: 220%; height: 220%; background-color: rgba(251, 191, 36, 0.25); border-radius: 50%; z-index: 1;"></div>
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: #fbbf24; border: 2px solid #111827; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.4); z-index: 2;"></div>
        </div>
      `,
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
  }, [map, userLocation, filterRadius, showLocationMarker]);

  const { createPopupNode } = useMapMarkers({
    map,
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
      const node = createPopupNode(selectedSuggestion, isSaved, map);
      suggestionNodeRef.current.innerHTML = "";
      suggestionNodeRef.current.appendChild(node);
    }
  }, [selectedSuggestion, savedIds, map, createPopupNode]);

  const isHe = lang === 'he';

  // 🌟 העדכון לנייד! peek זה עכשיו רק 20% במובייל כדי שלא יסתיר, אבל 30% במחשב.
  const drawerWidthClass = drawerMode === 'peek' 
    ? "w-[35%] md:w-[30%]" 
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
                   if (map) map.setView([finalLat, finalLng], 16);
                   
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
                  map.setView([31.7683, 35.2137], 3);
                  setIsFollowing(false);
                  setShowLocationMarker(false);
                } else {
                  setIsLocating(true);
                  map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
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
                          map.setView([selectedSuggestion.latitude, selectedSuggestion.longitude], 16);
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