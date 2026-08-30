// שימי לב שהקובץ התחלק לשניים: הקוד למעלה זה Home, וזה הקוד של Map 
// חשוב שיהיו באותו קובץ או שתפרידי אותם אם הם נפרדים אצלך!
// אם הקוד של Map נמצא באותו קובץ אצלך, תדביקי גם את זה:

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
};

type ModalState = {
  lat: number;
  lng: number;
} | null;

export default function Map({
  activeCategory,
  isCompassMode,
  searchQuery,
  setCompassMode,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  const [map, setMap] = useState<L.Map | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [isFollowing, setIsFollowing] = useState(false);
  const [filterRadius, setFilterRadius] = useState<number | null>(null);
  
  // 🌟 סטייט חדש ששומר אם ה-GPS מנסה לאתר כרגע
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
      center: [20, 0],
      zoom: isMobile ? 1.0 : 2.5,
      minZoom: isMobile ? 0.8 : 2.3,
      maxZoom: 18,
      maxBounds: worldBounds,
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
      zoomControl: true,
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

  useEffect(() => {
    if (!isLoggedIn) return;

    async function loadHistory() {
      try {
        const res = await fetch("/api/history");
        if (res.ok) {
          const data = await res.json();
          setViewedIds(data.map((p: Point) => p.id));
        }
      } catch (err) {}
    }

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
      } catch (err) {}
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
      setPoints(data);
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
      }
    };

    window.addEventListener("points-updated", refresh);
    return () => {
      window.removeEventListener("points-updated", refresh);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!isCompassMode) return;

      if (!activeCategory) {
        alert("צריך לבחור קטגוריה לפני הוספת גרעין");
        return;
      }

      if (!isLoggedIn) {
        alert("צריך להתחבר כדי להוסיף גרעין");
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
      alert("לא הצלחנו למצוא את המיקום שלך. ודא ששירותי המיקום (GPS) דולקים ואישרת לדפדפן לגשת אליהם.");
    };

    const handleLocationFound = (e: any) => {
      setIsLocating(false);
      
      // 🌟 ההגנה המרכזית: בדיקת 0,0! אם ה-GPS מחזיר 0,0 זה אומר שהייתה שגיאה פנימית במכשיר
      if (e.latlng.lat === 0 && e.latlng.lng === 0) {
        setIsFollowing(false);
        setUserLocation(null);
        setFilterRadius(null); // מכבים את הסינון כדי לא להעלים לו את הנקודות
        alert("שירות המיקום של המכשיר שלך לא יציב כרגע. אנא נסה שוב מאוחר יותר.");
        return;
      }

      setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      setIsFollowing(true); // המפה ממוקדת על המשתמש
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
  }, [map, isCompassMode, activeCategory, isLoggedIn]);

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
    // מנקים מעגל קודם אם קיים (חשוב במיוחד כשהרדיוס מבוטל)
    map?.eachLayer((layer: any) => {
      if (layer.options && layer.options.dashArray === "5, 5") {
        map.removeLayer(layer);
      }
    });

    if (!map || !userLocation || !filterRadius) return;

    const circle = L.circle([userLocation.lat, userLocation.lng], {
      radius: filterRadius * 1000,
      color: '#FFD700',
      fillColor: '#FFD700',
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: "5, 5"
    }).addTo(map);

    map.fitBounds(circle.getBounds());

  }, [map, userLocation, filterRadius]);

  useMapMarkers({
    map,
    points: filteredPoints,
    activeCategory,
    viewedIds,
    savedIds,
  });

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapRef}
        className="w-full h-full min-h-[50vh] rounded-2xl overflow-hidden bg-black relative"
      />

      {isCompassMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
          <img
            src="/icons/ui/location/location.png"
            alt="Target Location"
            className="w-12 h-12 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]"
          />
        </div>
      )}

      {modal && (
        <PointForm
          mode="create"
          category={activeCategory}
          initialData={{
            lat: modal.lat,
            lng: modal.lng,
          }}
          onClose={() => setModal(null)}
          onSubmit={async ({ form }) => {
            if (status !== "authenticated") return;

            let finalLat = modal.lat;
            let finalLng = modal.lng;

            const cleanAddress = form.address ? form.address.trim() : "";

            if (cleanAddress !== "") {
              try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1`);
                const geoData = await geoRes.json();

                if (geoData && geoData.length > 0) {
                  finalLat = parseFloat(geoData[0].lat);
                  finalLng = parseFloat(geoData[0].lon);
                } else {
                  const useCompass = window.confirm("המיקום שלך לא נקלט, האם להשתמש במיקום של המצפן במפה?");
                  if (!useCompass) {
                    alert("אנא הזן רחוב, מספר ועיר בלבד");
                    return;
                  }
                }
              } catch (err) {}
            } else {
              const useCompass = window.confirm("לא הזנת כתובת. האם לשמור את הנקודה לפי המיקום של המצפן במפה?");
              if (!useCompass) {
                alert("אנא הזן רחוב, מספר ועיר בלבד");
                return;
              }
            }

            const formData = new FormData();
            formData.append("name", form.name);
            formData.append("description", form.description);
            formData.append("address", cleanAddress);
            formData.append("website", form.website);
            formData.append("category", activeCategory ?? "");
            formData.append("latitude", String(finalLat));
            formData.append("longitude", String(finalLng));

            if (form.images && form.images.length > 0) {
              form.images.forEach((img) => {
                formData.append("images", img);
              });
            }

            if (form.extraInfo) {
              formData.append("extraInfo", form.extraInfo);
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

            if (map) {
              map.setView([finalLat, finalLng], 16);
            }
          }}
        />
      )}

      {/* כפתור מיקום - GPS משולב (עם חיווי טעינה כשהוא מחפש) */}
      <button
        onClick={() => {
          if (!map) return;
          if (isLocating) return; // לא עושים כלום אם כבר מחפשים

          if (isFollowing) {
            map.setView([31.7683, 35.2137], 3); // חזרה לישראל
            setIsFollowing(false);
          } else {
            setIsLocating(true); // מדליקים אנימציית טעינה
            map.locate({
              setView: true,
              maxZoom: 16,
              enableHighAccuracy: true
            });
          }
        }}
        className={`absolute bottom-6 right-6 z-[400] border p-3 rounded-full shadow-lg transition-colors ${
          isLocating ? "bg-gray-800 border-yellow-500 cursor-wait" : "bg-gray-900 border-gray-700 hover:bg-gray-800"
        }`}
        title={isFollowing ? "זום אאוט למפה" : "המיקום שלי"}
      >
        {isLocating ? (
           // אנימציית טעינה יפה
           <svg className="animate-spin h-6 w-6 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
        ) : isFollowing ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-7.364l-1.414 1.414M6.05 17.95l-1.414 1.414m13.314 0l-1.414-1.414M6.05 6.05L4.636 4.636M12 15a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
        )}
      </button>

      {/* תפריט רדיוס חכם */}
      <div className="absolute bottom-6 right-20 z-[400] flex flex-col-reverse items-end gap-2">

        <button
          onClick={() => {
            // 🌟 התיקון הקריטי לתפריט הרדיוס: אם אין לנו מיקום, אנחנו קודם מפעילים איתור ולא נותנים לבחור
            if (!userLocation && map) {
              if (!isLocating) {
                setIsLocating(true);
                map.locate({ enableHighAccuracy: true });
              }
              alert("מאתר מיקום... אנא המתן לפני בחירת רדיוס.");
              return;
            }
            setShowRadiusMenu(!showRadiusMenu);
          }}
          className={`p-3 rounded-full shadow-lg transition-colors border ${filterRadius
            ? "bg-yellow-500 border-yellow-400 text-black"
            : "bg-gray-900 border-gray-700 text-yellow-500 hover:bg-gray-800"
            }`}
          title="סינון לפי מרחק"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {showRadiusMenu && userLocation && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl flex flex-col p-1 w-32 max-h-60 overflow-y-auto custom-scrollbar">
            <button
              onClick={() => { setFilterRadius(null); setShowRadiusMenu(false); }}
              className={`text-right p-2 text-sm rounded-lg hover:bg-gray-800 ${!filterRadius ? "text-yellow-400 font-bold" : "text-gray-300"}`}
            >
              ללא סינון
            </button>

            {Array.from({ length: 10 }, (_, i) => (i + 1) * 5).map((dist) => (
              <button
                key={dist}
                onClick={() => { setFilterRadius(dist); setShowRadiusMenu(false); }}
                className={`text-right p-2 text-sm rounded-lg hover:bg-gray-800 ${filterRadius === dist ? "text-yellow-400 font-bold bg-gray-800" : "text-gray-300"}`}
              >
                עד {dist} ק"מ
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}