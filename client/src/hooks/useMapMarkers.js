import { useMemo } from "react";

const getCoordinates = (report) => {
  const coordinates = report?.location?.coordinates;

  if (
    Array.isArray(coordinates) &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1])
  ) {
    return {
      lng: coordinates[0],
      lat: coordinates[1],
    };
  }

  return null;
};

export default function useMapMarkers(reports) {
  return useMemo(() => {
    if (!Array.isArray(reports) || reports.length === 0) {
      return [];
    }

    const reportsWithCoordinates = reports
      .map((report) => {
        const coordinates = getCoordinates(report);

        if (!coordinates) {
          return null;
        }

        return {
          id: report._id,
          report,
          lat: coordinates.lat,
          lng: coordinates.lng,
          status: report.status || "pending",
        };
      })
      .filter(Boolean);

    return reportsWithCoordinates.map((marker) => {
      const nearbyCount = reportsWithCoordinates.filter((candidate) => {
        const lngDistance = Math.abs(candidate.lng - marker.lng);
        const latDistance = Math.abs(candidate.lat - marker.lat);

        return lngDistance <= 0.008 && latDistance <= 0.008;
      }).length;

      return {
        ...marker,
        nearbyCount,
      };
    });
  }, [reports]);
}
