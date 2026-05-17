import { useEffect, useMemo, useRef, useState, memo } from "react";
import L, { divIcon, latLngBounds } from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  Rectangle,
  TileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet";
import StatusBadge from "./StatusBadge";

const INDIA_CENTER = [20.5937, 78.9629];
const noop = () => {};

const HEATMAP_STOPS = [
  { stop: 0, color: [57, 114, 102] },
  { stop: 0.28, color: [95, 202, 165] },
  { stop: 0.5, color: [250, 204, 21] },
  { stop: 0.72, color: [249, 115, 22] },
  { stop: 1, color: [239, 68, 68] },
];

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

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

const createClusterIcon = (count, hasSelectedMember) =>
  divIcon({
    className: "dashboard-cluster-wrapper",
    html: `<span class="dashboard-cluster ${
      hasSelectedMember ? "is-selected" : ""
    }">${count}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -20],
  });

const formatLocationSource = (source) => {
  if (source === "browser") return "Browser GPS";
  if (source === "exif") return "Photo EXIF";
  if (source === "manual") return "Manual GPS";
  return "Unknown source";
};

const getInterpolatedHeatColor = (normalizedAlpha) => {
  if (normalizedAlpha <= HEATMAP_STOPS[0].stop) {
    return HEATMAP_STOPS[0].color;
  }

  for (let index = 1; index < HEATMAP_STOPS.length; index += 1) {
    const previous = HEATMAP_STOPS[index - 1];
    const current = HEATMAP_STOPS[index];

    if (normalizedAlpha <= current.stop) {
      const range = current.stop - previous.stop || 1;
      const ratio = (normalizedAlpha - previous.stop) / range;

      return previous.color.map((channel, channelIndex) =>
        Math.round(channel + (current.color[channelIndex] - channel) * ratio)
      );
    }
  }

  return HEATMAP_STOPS[HEATMAP_STOPS.length - 1].color;
};

const drawHeatmap = (ctx, width, height, points) => {
  ctx.clearRect(0, 0, width, height);

  points.forEach((point) => {
    const radius = point.radius;
    const gradient = ctx.createRadialGradient(
      point.x,
      point.y,
      0,
      point.x,
      point.y,
      radius
    );

    gradient.addColorStop(0, `rgba(255, 255, 255, ${point.alpha})`);
    gradient.addColorStop(0.35, `rgba(255, 255, 255, ${point.alpha * 0.55})`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(
      point.x - radius,
      point.y - radius,
      radius * 2,
      radius * 2
    );
  });

  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;

    if (alpha === 0) {
      continue;
    }

    const [red, green, blue] = getInterpolatedHeatColor(alpha);
    data[index] = red;
    data[index + 1] = green;
    data[index + 2] = blue;
    data[index + 3] = Math.round(clamp(alpha * 235, 35, 210));
  }

  ctx.putImageData(image, 0, 0);
};

function HeatmapLayer({ hotspots }) {
  const map = useMap();
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = L.DomUtil.create("canvas", "reports-heatmap-layer");
    const pane = map.getPanes().overlayPane;
    pane.appendChild(canvas);
    canvasRef.current = canvas;

    const redraw = () => {
      if (!canvasRef.current) {
        return;
      }

      const size = map.getSize();
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      const canvasElement = canvasRef.current;

      canvasElement.width = size.x;
      canvasElement.height = size.y;
      canvasElement.style.width = `${size.x}px`;
      canvasElement.style.height = `${size.y}px`;
      L.DomUtil.setPosition(canvasElement, topLeft);

      const ctx = canvasElement.getContext("2d");
      if (!ctx) {
        return;
      }

      const points = hotspots.map((hotspot) => {
        const layerPoint = map
          .latLngToLayerPoint([hotspot.lat, hotspot.lng])
          .subtract(topLeft);
        const normalizedWeight = clamp((hotspot.count || 1) / 6, 0.2, 1);

        return {
          x: layerPoint.x,
          y: layerPoint.y,
          radius: 55 + normalizedWeight * 65,
          alpha: 0.18 + normalizedWeight * 0.32,
        };
      });

      drawHeatmap(ctx, size.x, size.y, points);
    };

    map.on("moveend zoomend resize", redraw);
    redraw();

    return () => {
      map.off("moveend zoomend resize", redraw);

      if (canvasRef.current?.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
    };
  }, [hotspots, map]);

  return null;
}

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

const clusterMarkers = (map, markers, zoom, selectedReportId) => {
  if (!markers.length) {
    return [];
  }

  const clusterRadius =
    zoom >= 16 ? 24 : zoom >= 13 ? 34 : zoom >= 10 ? 48 : 62;
  const clusters = [];

  markers.forEach((marker) => {
    const projectedPoint = map.project([marker.lat, marker.lng], zoom);
    let targetCluster = null;

    for (const cluster of clusters) {
      const distance = projectedPoint.distanceTo(cluster.centerPoint);

      if (distance <= clusterRadius) {
        targetCluster = cluster;
        break;
      }
    }

    if (!targetCluster) {
      clusters.push({
        centerPoint: projectedPoint,
        members: [marker],
        hasSelectedMember: marker.id === selectedReportId,
      });
      return;
    }

    targetCluster.members.push(marker);
    targetCluster.hasSelectedMember =
      targetCluster.hasSelectedMember || marker.id === selectedReportId;

    const memberCount = targetCluster.members.length;
    const nextCenter = targetCluster.members.reduce(
      (accumulator, member) => {
        const point = map.project([member.lat, member.lng], zoom);
        accumulator.x += point.x;
        accumulator.y += point.y;
        return accumulator;
      },
      { x: 0, y: 0 }
    );

    targetCluster.centerPoint = L.point(
      nextCenter.x / memberCount,
      nextCenter.y / memberCount
    );
  });

  return clusters.map((cluster, index) => {
    const lat =
      cluster.members.reduce((sum, member) => sum + member.lat, 0) /
      cluster.members.length;
    const lng =
      cluster.members.reduce((sum, member) => sum + member.lng, 0) /
      cluster.members.length;

    return {
      id: `cluster-${index}`,
      count: cluster.members.length,
      hasSelectedMember: cluster.hasSelectedMember,
      lat,
      lng,
      members: cluster.members,
    };
  });
};

function ClusteredMarkerLayer({
  markers,
  selectedReportId,
  onSelectReport,
  getImageUrl,
  markerRefs,
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const syncZoom = () => {
      setZoom(map.getZoom());
    };

    map.on("zoomend", syncZoom);
    return () => {
      map.off("zoomend", syncZoom);
    };
  }, [map]);

  const clusteredMarkers = useMemo(
    () => clusterMarkers(map, markers, zoom, selectedReportId),
    [map, markers, selectedReportId, zoom]
  );

  return (
    <>
      {clusteredMarkers.map((entry) => {
        if (entry.count === 1) {
          const marker = entry.members[0];
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
              <Popup minWidth={240}>
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
                      <span>{formatLocationSource(marker.report.locationSource)}</span>
                      <span>
                        Priority: {(marker.priority || "low").toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        }

        const bounds = latLngBounds(
          entry.members.map((member) => [member.lat, member.lng])
        );

        return (
          <Marker
            key={entry.id}
            position={[entry.lat, entry.lng]}
            icon={createClusterIcon(entry.count, entry.hasSelectedMember)}
            eventHandlers={{
              click: () => {
                map.fitBounds(bounds, {
                  padding: [40, 40],
                  maxZoom: Math.min(map.getZoom() + 2, 16),
                });
              },
            }}
          >
            <Popup minWidth={220}>
              <div className="map-popup">
                <div className="map-popup-copy">
                  <h3>{entry.count} nearby reports</h3>
                  <p>
                    This live cluster updates with zoom level so the map stays
                    readable during dense report bursts.
                  </p>
                  <div className="map-popup-meta">
                    <span>Click the cluster to zoom into this group</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

const ReportsMap = memo(function ReportsMap({
  markers,
  selectedReportId = null,
  onSelectReport = noop,
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
        <HeatmapLayer hotspots={hotspots} />

        {hotspots.map((hotspot) => {
          if (!hotspot.bounds) {
            return null;
          }

          return (
            <Rectangle
              key={`hotspot-zone-${hotspot.zoneId}`}
              bounds={[
                [hotspot.bounds.south, hotspot.bounds.west],
                [hotspot.bounds.north, hotspot.bounds.east],
              ]}
              pathOptions={{
                className: "hotspot-zone-outline",
                color:
                  hotspot.severity === "high"
                    ? "#ef4444"
                    : hotspot.severity === "medium"
                      ? "#f97316"
                      : "#facc15",
                weight: 1.5,
                fillOpacity: 0.06,
              }}
            >
              <Popup>
                <strong>Hotspot zone {hotspot.zoneId}</strong>
                <br />
                {hotspot.count} reports inside this bucketed zone
                <br />
                Severity: {hotspot.severity}
              </Popup>
            </Rectangle>
          );
        })}

        <ClusteredMarkerLayer
          markers={markers}
          selectedReportId={selectedReportId}
          onSelectReport={onSelectReport}
          getImageUrl={getImageUrl}
          markerRefs={markerRefs}
        />
      </MapContainer>

      {!markers.length ? (
        <div className="map-overlay-empty">
          <h3>No mapped reports available</h3>
          <p>Reports with valid coordinates will appear here automatically.</p>
        </div>
      ) : null}

      <div className="map-chip chip-left">
        Heatmap + bucket zones
      </div>
      <div className="map-chip chip-right">
        {selectedMarker ? "Report selected" : `${hotspots.length} hotspot zones`}
      </div>
    </div>
  );
});

export default ReportsMap;
