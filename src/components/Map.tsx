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

  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [isFollowing, setIsFollowing] = useState(false);

  const [filterRadius, setFilterRadius] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showRadiusMenu, setShowRadiusMenu] = useState(false);

  /*
  ================================================================================
  🌍 INIT MAP
  ================================================================================
  */
  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current;
    
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
      container.innerHTML = ""; 
    }

    const isMobile = window.innerWidth < 768;
    const minZoom = isMobile ? 1 : 1.5;

    const worldBounds = L.latLngBounds([-90, -180], [90, 180]);

    const newMap = L.map(container, {
      center: [20, 0], 
      zoom: minZoom,
      minZoom: minZoom, 
      maxZoom: 18,
      maxBounds: worldBounds, 
      maxBoundsViscosity: 1.0, 
      zoomSnap: 0,
      worldCopyJump: false,
    });

    L.tileLayer(
      'https://tile.jawg.io/371d6e14-ccbe-4752-851a-0f972397d066/{z}/{x}/{y}.png?access-token=9Wgf5GCT2UODKE6L3OFQkzJMrlK58O4oUrxynRP2dlsmh2SP76m9OyVQJGQqQHgd', 
      {
        attribution: '&copy; <a href="https://www.jawg.io/">Jawg</a>',
        noWrap: true, 
        bounds: worldBounds,
        keepBuffer: 2 
      }
    ).addTo(newMap);

    setMap(newMap);

    return () => {
      newMap.remove();
    };
  }, []);
  
  /*
  ================================================================================
  📡 LOAD POINTS, HISTORY & SAVED
  ================================================================================
  */
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
      } catch (err) {
        console.error("Failed to load history", err);
      }
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
      } catch (err) {
        console.error("Failed to load saved points", err);
      }
    }

    loadSaved();
  }, [isLoggedIn]);

  /*
  ================================================================================
  🔄 SEARCH & LIVE REFRESH
  ================================================================================
  */
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

  /*
  ================================================================================
  📍 MAP EVENTS (CLICK, LOCATION, MOVE)
  ================================================================================
  */
  useEffect(() => {
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!isCompassMode) return;

      if (!activeCategory) {
        alert("צריך לבחור קטגוריה לפני הוספת נקודה");
        return;
      }

      if (!isLoggedIn) {
        alert("צריך להתחבר כדי להוסיף נקודה");
        return;
      }

      setModal({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    };

    const handleLocationError = () => {
      alert("לא הצלחנו למצוא את המיקום שלך. ודאי ששירותי המיקום (GPS) דולקים ואישרת לדפדפן לגשת אליהם.");
    };

    const handleLocationFound = (e: any) => {
      setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng }); 
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

  /*
  ================================================================================
  🔍 RADIUS FILTER (דברים סביבי)
  ================================================================================
  */
  // מונע בנייה מחדש של המערך סתם כך בעזרת useMemo
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

    return () => { circle.remove(); };
  }, [map, userLocation, filterRadius]);

  /*
  ================================================================================
  📍 MARKERS
  ================================================================================
  */
  useMapMarkers({
    map,
    points: filteredPoints, // חייב להיות המשתנה המסונן
    activeCategory,
    viewedIds,
    savedIds,
  });

  /*
  ================================================================================
  🧠 UI
  ================================================================================
  */
  return (
    <div className="relative w-full h-[70vh]">

      {/* MAP */}
      <div
        ref={mapRef}
        className="w-full h-full rounded-2xl overflow-hidden bg-black relative"
      />

      {/* CROSSHAIR (IMAGE) OVERLAY */}
      {isCompassMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
          <img
            src="/icons/ui/location/location.png"
            alt="Target Location"
            className="w-12 h-12 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]"
          />
        </div>
      )}

      {/* MODAL */}
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

            // ברירת מחדל: המיקום של המצפן
            let finalLat = modal.lat;
            let finalLng = modal.lng;

            // 🌍 המרת כתובת לקואורדינטות (Geocoding)
            if (form.address && form.address.trim() !== "") {
              try {
                // פונים ל-API החינמי של OpenStreetMap
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}&limit=1`);
                const geoData = await geoRes.json();
                
                if (geoData && geoData.length > 0) {
                  // אם נמצאה כתובת, דורסים את המיקום של המצפן
                  finalLat = parseFloat(geoData[0].lat);
                  finalLng = parseFloat(geoData[0].lon); 
                } else {
                  // הכתובת לא נמצאה - שואלים את המשתמש מה לעשות
                  const useCompass = window.confirm("המיקום שלך לא נקלט, האם להשתמש במיקום של המצפן במפה?");
                  
                  if (!useCompass) {
                    // המשתמש לחץ "ביטול"
                    alert("אנא הזן כתובת בשנית");
                    return; // 👈 עוצר לחלוטין את פעולת השמירה ומשאיר את הטופס פתוח!
                  }
                  // אם המשתמש לחץ "אישור" (useCompass === true), הקוד פשוט ימשיך הלאה
                  // וישתמש ב-finalLat ו-finalLng המקוריים של המצפן.
                }
              } catch (err) {
                console.error("Geocoding failed:", err);
              }
            }

            const formData = new FormData();

            formData.append("name", form.name);
            formData.append("description", form.description);
            formData.append("address", form.address);
            formData.append("website", form.website);
            formData.append("category", activeCategory ?? "");
            
            // 👈 כאן אנחנו משתמשים במיקום הסופי (מהכתובת או מהמצפן)
            formData.append("latitude", String(finalLat));
            formData.append("longitude", String(finalLng));

            if (form.image) {
              formData.append("image", form.image);
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

            // ✨ בונוס UX: מזיזים את המפה בדיוק למיקום של הנקודה החדשה שנוצרה!
            if (map) {
              map.setView([finalLat, finalLng], 16);
            }
          }}
        />
      )}


      {/* כפתור מיקום - GPS משולב */}
      <button
        onClick={() => {
          if (!map) return;

          if (isFollowing) {
            map.setView([31.7683, 35.2137], 3); 
            setIsFollowing(false);
          } else {
            map.locate({
              setView: true,
              maxZoom: 16,
              enableHighAccuracy: true
            });
            setIsFollowing(true);
          }
        }}
        className="absolute bottom-6 right-6 z-[400] bg-gray-900 border border-gray-700 p-3 rounded-full shadow-lg hover:bg-gray-800 transition-colors"
        title={isFollowing ? "זום אאוט למפה" : "המיקום שלי"}
      >
        {isFollowing ? (
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
        
        {/* כפתור הפעלה */}
        <button
          onClick={() => {
            if (!userLocation && map) {
              map.locate({ enableHighAccuracy: true });
            }
            setShowRadiusMenu(!showRadiusMenu);
          }}
          className={`p-3 rounded-full shadow-lg transition-colors border ${
            filterRadius 
              ? "bg-yellow-500 border-yellow-400 text-black" 
              : "bg-gray-900 border-gray-700 text-yellow-500 hover:bg-gray-800"
          }`}
          title="סינון לפי מרחק"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* רשימת המרחקים הקופצת */}
        {showRadiusMenu && (
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