import React, { useEffect, useRef, useId } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Haversine formula helper
function getDistanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SmallMap({ unitLocation, radius = 100, studentLocation }) {
    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);
    const mapId = useId();

    useEffect(() => {
        if (!unitLocation?.lat || !unitLocation?.lng || !mapContainerRef.current) return;

        // Fix: clear any previous map instance (prevents needing double save)
        if (mapContainerRef.current._leaflet_id) {
            try {
                mapContainerRef.current._leaflet_id = null;
            } catch (e) {
                console.warn("Failed to clear old map id:", e);
            }
        }

        let map = mapRef.current;

        // Initialize map only once
        if (!map) {
            map = L.map(mapContainerRef.current, {
                zoomControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false,
                tap: false,
            });
            mapRef.current = map;

            // Add tiles once
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors",
            }).addTo(map);
        }


        // Set the view and clear previous layers except the base tile
        map.setView([unitLocation.lat, unitLocation.lng], 17);
        map.eachLayer(layer => {
            if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
        });

        // Add circle
        L.circle([unitLocation.lat, unitLocation.lng], {
            color: "#38bdf8",
            fillColor: "#38bdf8",
            fillOpacity: 0.15,
            radius,
        }).addTo(map);

        // Add student marker if available
        if (studentLocation?.lat && studentLocation?.lng) {
            const distance = getDistanceMeters(
                unitLocation.lat,
                unitLocation.lng,
                studentLocation.lat,
                studentLocation.lng
            );
            const withinRadius = distance <= radius;

            const icon = L.divIcon({
                html: `<div style="
        background:${withinRadius ? '#4ade80' : '#f87171'};
        width:16px;
        height:16px;
        border-radius:50%;
        border:2px solid white;
        box-shadow:0 0 6px ${withinRadius ? '#4ade80' : '#f87171'};
      "></div>`,
                className: "",
                iconSize: [16, 16],
            });

            const marker = L.marker([studentLocation.lat, studentLocation.lng], { icon }).addTo(map);
            marker.bindPopup(withinRadius ? "✅ Within attendance zone" : "⚠️ Outside attendance zone").openPopup();
        }

        // Fix map sizing
        setTimeout(() => map.invalidateSize(), 300);

        // Cleanup only on unmount
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [unitLocation, radius, studentLocation]);


    if (!unitLocation?.lat || !unitLocation?.lng)
        return <p>📍 Location unavailable</p>;

    if (!studentLocation)
        return (
            <div style={{ color: "#f87171", marginTop: "10px" }}>
                📍 Location unavailable
            </div>
        );

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "200px",
                marginTop: "12px",
                borderRadius: "12px",
                overflow: "hidden",
                zIndex: 1,
            }}
        >
            <div
                ref={mapContainerRef}
                id={mapId}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: "200px",
                }}
            />
        </div>
    );
}
