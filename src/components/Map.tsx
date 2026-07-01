"use client";

import { useEffect, useRef, useState } from "react";
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

  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const cursorMarkerRef = useRef<L.Marker | null>(null);

  /*
  ================================================================================
  🌍 INIT MAP
  ================================================================================
  */
  useEffect(() => {
    if (!mapRef.current) return;

    if ((mapRef.current as any)._leaflet_id) {
      (mapRef.current as any)._leaflet_id = null;
    }

    const newMap = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: 18,
      worldCopyJump: false,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1.0,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; OpenStreetMap & CARTO",
        noWrap: true,
      }
    ).addTo(newMap);

    setMap(newMap);

    return () => {
      newMap.remove();
    };
  }, []);

  /*
  ================================================================================
  📡 LOAD POINTS
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

  /*
  ================================================================================
  🖱️ PREVIEW CURSOR (DESKTOP ONLY)
  ================================================================================
  */
  useEffect(() => {
    if (!map) return;

    const isMobile =
      typeof window !== "undefined" && window.innerWidth < 768;

    if (!isCompassMode || isMobile) {
      if (cursorMarkerRef.current) {
        map.removeLayer(cursorMarkerRef.current);
        cursorMarkerRef.current = null;
      }
      return;
    }

    const previewIcon = L.icon({
      iconUrl: "/icons/ui/compass/active.png",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const handleMove = (e: any) => {
      const latlng = e.latlng;

      if (!cursorMarkerRef.current) {
        cursorMarkerRef.current = L.marker(latlng, {
          icon: previewIcon,
          opacity: 0.9,
        }).addTo(map);
      } else {
        cursorMarkerRef.current.setLatLng(latlng);
      }
    };

    map.on("mousemove", handleMove);

    return () => {
      map.off("mousemove", handleMove);

      if (cursorMarkerRef.current) {
        map.removeLayer(cursorMarkerRef.current);
        cursorMarkerRef.current = null;
      }
    };
  }, [map, isCompassMode]);

  /*
  ================================================================================
  🔄 SEARCH
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

  /*
  ================================================================================
  🔄 LIVE REFRESH
  ================================================================================
  */
  useEffect(() => {
    const refresh = async () => {
      const res = await fetch("/api/points");
      const data = await res.json();
      setPoints(data);
    };

    window.addEventListener("points-updated", refresh);

    return () => {
      window.removeEventListener("points-updated", refresh);
    };
  }, []);

  /*
  ================================================================================
  📍 MAP CLICK
  ================================================================================
  */
  useEffect(() => {
    if (!map) return;

    const handleClick = (e: any) => {
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

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map, isCompassMode, activeCategory]);

  /*
  ================================================================================
  📍 MARKERS
  ================================================================================
  */
  useMapMarkers({
    map,
    points,
    activeCategory,
  });

  /*
  ================================================================================
  🧠 UI
  ================================================================================
  */
  return (
    <div className="relative w-full h-full">

      {/* MAP */}
      <div
        ref={mapRef}
        className="w-full h-[70vh] rounded-2xl overflow-hidden bg-black"
      />

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

            const formData = new FormData();

            formData.append("name", form.name);
            formData.append("description", form.description);
            formData.append("address", form.address);
            formData.append("website", form.website);
            formData.append("category", activeCategory ?? "");
            formData.append("latitude", String(modal.lat));
            formData.append("longitude", String(modal.lng));

            if (form.image) {
              formData.append("image", form.image);
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

            // 🔥 לכבות מצב הוספה
            setCompassMode(false);
          }}
        />
      )}
    </div>
  );
}