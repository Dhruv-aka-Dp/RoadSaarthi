import React, { useEffect, useMemo, useRef, memo } from "react";
import { divIcon, latLngBounds } from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
  Circle,
  useMap,
} from "react-leaflet";
import StatusBadge from "./StatusBadge";

const INDIA_CENTER = [20.5937, 78.9629];

const createStatusIcon = (status, isSelected) =>
  divIcon({
    className: "dashboard-marker-wrapper",
    html: `<span class="dashboard-marker dashboard-marker--${status} ${
      isSelected ? "is-selected" : ""
    }"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });

function MapViewportController({ markers, selectedReportId }) {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) {
      map.setView(INDIA_CENTER, 5);
      return;
    }

    const selectedMarker = markers.find((marker) => marker.id === selectedReportId);

    if (selectedMarker) {
      map.flyTo([selectedMarker.lat, selectedMarker.lng], 16, {
        duration: 0.8,
      });
      return;
    }

    const bounds = latLngBounds(markers.map((marker) => [marker.lat, marker.lng]));
    map.fitBounds(bounds, {
      padding: [36, 36],
    });
  }, [map, markers, selectedReportId]);

  return null;
}

const ReportsMap = memo(function ReportsMap({
  markers,
  selectedReportId,
  onSelectReport,
  getImageUrl,
  hotspots = [],
}) {
  const markerRefs = useRef({});

  useEffect(() => {
    if (!selectedReportId) {
      return;
    }

    markerRefs.current[selectedReportId]?.openPopup();
  }, [selectedReportId]);

  const selectedMarker = useMemo(() => {
    return markers.find((marker) => marker.id === selectedReportId) || null;
  }, [markers, selectedReportId]);

  return (
    <div className="leaflet-shell">
      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        zoomControl={false}
        className="reports-leaflet"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomright" />
        <MapViewportController
          markers={markers}
          selectedReportId={selectedReportId}
        />

        {hotspots.map((hotspot, index) => {
          let color = '#facc15'; // yellow (low)
          if (hotspot.severity === 'high') color = '#ef4444'; // red
          else if (hotspot.severity === 'medium') color = '#f97316'; // orange

          return (
            <Circle
              key={`hotspot-${index}`}
              center={[hotspot.lat, hotspot.lng]}
              radius={1100} // ~1.1km radius
              pathOptions={{ fillColor: color, color: color, fillOpacity: 0.3, weight: 2 }}
            >
              <Popup>
                <strong>🔥 High Risk Zone</strong><br/>
                {hotspot.count} issues reported in this area.
              </Popup>
            </Circle>
          );
        })}

        {markers.map((marker) => {
          const imageUrl = getImageUrl(marker.report.image);

          return (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={createStatusIcon(
                marker.status,
                marker.id === selectedReportId
              )}
              ref={(instance) => {
                if (instance) {
                  markerRefs.current[marker.id] = instance;
                }
              }}
              eventHandlers={{
                click: () => onSelectReport(marker.id),
              }}
            >
              <Popup minWidth={220}>
                <div className="map-popup">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={marker.report.title}
                      className="map-popup-image"
                    />
                  ) : null}

                  <div className="map-popup-copy">
                    <StatusBadge status={marker.status} />
                    <h3>{marker.report.title}</h3>
                    <p>{marker.report.description}</p>
                    <div className="map-popup-meta">
                      <span>
                        {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
                      </span>
                      {marker.priority && marker.priority !== 'low' ? (
                        <span style={{textTransform: 'capitalize'}}>Priority: {marker.priority}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {!markers.length ? (
        <div className="map-overlay-empty">
          <h3>No mapped reports available</h3>
          <p>Reports with valid coordinates will appear here automatically.</p>
        </div>
      ) : null}

      <div className="map-chip chip-left">Interactive map</div>
      <div className="map-chip chip-right">
        {selectedMarker ? "Report selected" : "Select a report"}
      </div>
    </div>
  );
});

export default ReportsMap;
