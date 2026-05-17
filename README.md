# RoadSaarthi

RoadSaarthi is a road-issue reporting platform focused on potholes, field assignment, and hotspot discovery. This version keeps the original product-style UI while adding the infrastructure and systems-demo requirements that the project brief emphasizes.

## What Changed

- EXIF GPS extraction now runs in a Node worker thread, with an inline fallback if the worker fails.
- Uploaded images are resized to 800px max and intentionally re-encoded so EXIF metadata is stripped from the stored image.
- Reports now record `locationSource` (`browser`, `manual`, or `exif`) plus image-processing metadata.
- Hotspot detection now uses a MongoDB `$bucket` aggregation over geographic grid zones instead of rounded coordinate grouping.
- Admin analytics now use MongoDB `$facet` to return status, priority, location-source, workload, daily-volume, and hotspot summaries in one pass.
- Admin/officer routes are now protected with role-based middleware.
- The map now includes a canvas heatmap layer, bucket-zone overlays, and live marker clustering.
- Benchmark/demo artifacts were added for seeded data, geospatial indexing, worker-thread offload, and client memoization.

## Requirement Matrix

| Requirement | Status | Evidence |
| --- | --- | --- |
| Citizen road issue reporting with image upload | Implemented | `client/src/components/ReportForm.jsx`, `server/controllers/reportController.js` |
| Auto-capture GPS from browser | Implemented | Report form now auto-attempts geolocation after image selection and submits `locationSource=browser` |
| EXIF GPS fallback | Implemented | `server/utils/imageProcessor.js`, `server/workers/exifWorker.js` |
| EXIF parsing in worker thread | Implemented | `server/utils/exifWorkerClient.js`, `server/workers/exifWorker.js` |
| Explicit CPU offload demo | Implemented | `server/scripts/benchmarkExifWorkers.js` |
| Image compression to 800px | Implemented | `server/utils/imageProcessor.js` |
| Explicit EXIF stripping | Implemented | `sharp` re-encode path in `server/utils/imageProcessor.js`, stored metadata in `imageProcessing.exifStripped` |
| MongoDB `2dsphere` index | Implemented | `server/models/Report.js` |
| Geospatial query for nearby reports | Implemented | `server/controllers/reportController.js` |
| Hotspot zoning with `$bucket` | Implemented | `server/utils/reportAnalytics.js` |
| Multi-dimensional analytics with `$facet` | Implemented | `server/utils/reportAnalytics.js`, `/api/reports/analytics` |
| PWD-style assign/resolve workflow | Implemented | `server/routes/reportRoutes.js`, admin/officer dashboards |
| Role protection for admin/officer actions | Implemented | `server/middleware/authMiddleware.js`, `server/routes/reportRoutes.js`, `server/routes/authRoutes.js` |
| Heatmap visualization | Implemented | `client/src/components/dashboard/ReportsMap.jsx` |
| Marker clustering | Implemented | `client/src/components/dashboard/ReportsMap.jsx` |
| `useMemo` optimization | Implemented | `client/src/hooks/useMapMarkers.js`, `client/src/pages/Dashboard.jsx` |
| Re-render/computation benchmarking | Implemented | `client/src/pages/Dashboard.jsx?benchmark=1` banner and looped benchmark mode |
| Horizontal scaling / indexed-query benchmark | Implemented | `server/scripts/seedReports.js`, `server/scripts/benchmarkGeoQueries.js` |
| Storage backend exactly S3/disk | Intentionally unchanged | The image pipeline still uses Cloudinary by design for this repo version |

## Benchmark Commands

Run these from `server/`:

```bash
npm run seed:reports -- --count 400 --replace-seeded
npm run benchmark:geo
npm run benchmark:exif
```

Client memoization benchmark:

```text
Open the dashboard with ?benchmark=1
Example: /dashboard?benchmark=1
```

The dashboard banner compares repeated naive recomputation against memoized reuse for the current report set.

## Key Files

- Backend image pipeline:
  `server/utils/imageProcessor.js`
  `server/utils/exifGps.js`
  `server/utils/exifWorkerClient.js`
  `server/workers/exifWorker.js`
- Backend analytics:
  `server/utils/reportAnalytics.js`
  `server/controllers/reportController.js`
- Route protection:
  `server/middleware/authMiddleware.js`
  `server/routes/reportRoutes.js`
  `server/routes/authRoutes.js`
- Frontend mapping and dashboards:
  `client/src/components/dashboard/ReportsMap.jsx`
  `client/src/components/dashboard/AdminDashboard.jsx`
  `client/src/pages/Dashboard.jsx`
  `client/src/components/ReportForm.jsx`

## Notes

- The project still uses Cloudinary rather than replacing storage with S3 or local disk.
- The hotspot grid is bucketed over India-oriented geographic bounds to keep the `$bucket` demo concrete and stable for this use case.
- Worker-thread EXIF extraction may not always be faster in raw wall-clock time than inline parsing, but it prevents the CPU-heavy parse from living on the main request thread.
