import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReportForm from "../components/ReportForm";
import ReportList from "../components/dashboard/ReportList";
import ReportsMap from "../components/dashboard/ReportsMap";
import StatsBar from "../components/dashboard/StatsBar";
import Toast from "../components/dashboard/Toast";
import useMapMarkers from "../hooks/useMapMarkers";
import API from "../services/api";
import AdminDashboard from "../components/dashboard/AdminDashboard";
import OfficerDashboard from "../components/dashboard/OfficerDashboard";
import "./Dashboard.css";

const STATUS_FILTERS = ["all", "pending", "assigned", "resolved"];
const DEFAULT_MAP_WIDTH = 40;
const MIN_MAP_WIDTH = 30;
const MAX_MAP_WIDTH = 55;

const getAssetBaseUrl = () => {
  const baseUrl = API.defaults.baseURL || "";
  return baseUrl.replace(/\/api\/?$/, "");
};

const getImageUrl = (imagePath) => {
  if (!imagePath || imagePath === "no-photo.jpg") {
    return null;
  }

  if (imagePath.startsWith("http")) {
    return imagePath;
  }

  return `${getAssetBaseUrl()}${imagePath}`;
};

const formatDateLabel = (createdAt) => {
  if (!createdAt) {
    return "Just now";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 60) {
    return `${Math.max(diffMinutes, 1)} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays <= 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

const formatLocationLabel = (report) => {
  const coordinates = report?.location?.coordinates;

  if (
    Array.isArray(coordinates) &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1])
  ) {
    return `Lat ${coordinates[1].toFixed(3)} / Lng ${coordinates[0].toFixed(3)}`;
  }

  return "Coordinates pending";
};

const sortReports = (reports, sortBy) => {
  const sorted = [...reports];

  if (sortBy === "oldest") {
    sorted.sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime()
    );
    return sorted;
  }

  if (sortBy === "status") {
    const order = { pending: 0, assigned: 1, resolved: 2 };
    sorted.sort((a, b) => {
      const statusDiff = (order[a.status] ?? 99) - (order[b.status] ?? 99);

      if (statusDiff !== 0) {
        return statusDiff;
      }

      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    });

    return sorted;
  }

  sorted.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );

  return sorted;
};

function Dashboard() {
  const [reports, setReports] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [mapWidth, setMapWidth] = useState(DEFAULT_MAP_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("roadsaarthi-user");
    return saved ? JSON.parse(saved) : { role: "user", name: "Guest User", officerId: "" };
  });

  const userRole = user.role;
  const assignmentOfficerId = user.officerId || "";
  const setAssignmentOfficerId = (val) => setUser(prev => ({ ...prev, officerId: val }));

  useEffect(() => {
    localStorage.setItem("roadsaarthi-user", JSON.stringify(user));
  }, [user]);

  const deferredSearch = useDeferredValue(searchQuery);
  const layoutRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const [reportsRes, hotspotsRes] = await Promise.all([
          API.get("/reports"),
          API.get("/reports/hotspots").catch(() => ({ data: { data: [] } })) // gracefully fallback if no endpoint
        ]);

        if (!isMounted) {
          return;
        }

        setReports(Array.isArray(reportsRes.data?.data) ? reportsRes.data.data : []);
        setHotspots(Array.isArray(hotspotsRes.data?.data) ? hotspotsRes.data.data : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setReports([]);
        setHotspots([]);
        setErrorMessage(
          error.response?.data?.error ||
            "Live backend could not be reached. Please check the server connection."
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Assignment ID sync removed as it is now part of user state


  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      if (!layoutRef.current) {
        return;
      }

      const bounds = layoutRef.current.getBoundingClientRect();
      const nextWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
      const clampedWidth = Math.min(
        MAX_MAP_WIDTH,
        Math.max(MIN_MAP_WIDTH, nextWidth)
      );

      setMapWidth(Number(clampedWidth.toFixed(1)));
    };

    const stopResize = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", stopResize);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!isReportModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isReportModalOpen]);

  const filteredReports = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    const matchedReports = reports.filter((report) => {
      const matchesStatus =
        statusFilter === "all" || report.status === statusFilter;

      const matchesSearch =
        normalizedQuery.length === 0
          ? true
          : [report.title, report.description]
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery);

      return matchesStatus && matchesSearch;
    });

    return sortReports(matchedReports, sortBy);
  }, [deferredSearch, reports, sortBy, statusFilter]);

  const markers = useMapMarkers(filteredReports);

  const activeSelectedReportId = useMemo(() => {
    if (!filteredReports.length) {
      return null;
    }

    const selectionStillVisible = filteredReports.some(
      (report) => report._id === selectedReportId
    );

    return selectionStillVisible ? selectedReportId : filteredReports[0]._id;
  }, [filteredReports, selectedReportId]);

  const summaryStats = useMemo(() => {
    return [
      { label: "Total reports", value: reports.length, tone: "neutral" },
      {
        label: "Pending",
        value: reports.filter((report) => report.status === "pending").length,
        tone: "pending",
      },
      {
        label: "Assigned",
        value: reports.filter((report) => report.status === "assigned").length,
        tone: "assigned",
      },
      {
        label: "Resolved",
        value: reports.filter((report) => report.status === "resolved").length,
        tone: "resolved",
      },
    ];
  }, [reports]);

  const markerLookup = useMemo(() => {
    return new Map(markers.map((marker) => [marker.id, marker]));
  }, [markers]);

  const isResetVisible = Math.abs(mapWidth - DEFAULT_MAP_WIDTH) > 0.4;

  const replaceReportInState = (nextReport) => {
    setReports((currentReports) =>
      currentReports.map((report) =>
        report._id === nextReport._id ? nextReport : report
      )
    );
  };

  const handleReportCreated = (report) => {
    if (!report?._id) {
      return;
    }

    setReports((currentReports) => {
      const withoutDuplicate = currentReports.filter(
        (currentReport) => currentReport._id !== report._id
      );

      return [report, ...withoutDuplicate];
    });
    setSelectedReportId(report._id);
    setIsReportModalOpen(false);
    setToast({
      type: "success",
      title: "Report submitted",
      message: "The new issue has been added to the dashboard.",
    });
  };

  const handleAssign = async (reportId, forcedOfficerId = null) => {
    const officerId = forcedOfficerId || user.officerId;

    if (!officerId) {
      setToast({
        type: "error",
        title: "Officer ID required",
        message: "Enter an officer ID before using the assign action.",
      });
      return;
    }

    const previousReport = reports.find((report) => report._id === reportId);

    if (!previousReport) {
      return;
    }

    const optimisticReport = {
      ...previousReport,
      assignedTo: officerId,
      status: "assigned",
    };

    replaceReportInState(optimisticReport);
    setSelectedReportId(reportId);
    setActionLoading({ type: "assign", id: reportId });

    try {
      const response = await API.patch(`/reports/${reportId}/assign`, {
        officerId,
      });

      replaceReportInState(response.data.data);
      setToast({
        type: "success",
        title: "Report assigned",
        message: "The selected report has been assigned successfully.",
      });
    } catch (error) {
      replaceReportInState(previousReport);
      setToast({
        type: "error",
        title: "Assign failed",
        message:
          error.response?.data?.error ||
          "The report could not be assigned right now.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (reportId) => {
    const previousReport = reports.find((report) => report._id === reportId);

    if (!previousReport) {
      return;
    }

    const optimisticReport = {
      ...previousReport,
      status: "resolved",
    };

    replaceReportInState(optimisticReport);
    setSelectedReportId(reportId);
    setActionLoading({ type: "resolve", id: reportId });

    try {
      const response = await API.patch(`/reports/${reportId}/resolve`);

      replaceReportInState(response.data.data);
      setToast({
        type: "success",
        title: "Report resolved",
        message: "The selected report is now marked as resolved.",
      });
    } catch (error) {
      replaceReportInState(previousReport);
      setToast({
        type: "error",
        title: "Resolve failed",
        message:
          error.response?.data?.error ||
          "The report could not be resolved right now.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-backdrop" />

      <header className="dashboard-header">
        <div className="brand-column">
          <span className="dashboard-kicker">Civic Monitoring Dashboard</span>
          <div className="brand-lockup">
            <div className="brand-mark">RS</div>
            <div>
              <h1>RoadSaarthi</h1>
              <p>Road reports, map monitoring, and action flow in one screen.</p>
            </div>
          </div>
        </div>

        <div className="header-controls">
          <div className="role-selector-shell" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#56736b' }}>Switch View (Simulate)</span>
            <div className="role-pills" style={{ display: 'flex', gap: '5px' }}>
              {['user', 'officer', 'admin'].map(role => (
                <button
                  key={role}
                  onClick={() => setUser({ ...user, role, officerId: role === 'officer' ? "OFF-001" : "" })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(17,61,53,0.1)',
                    background: user.role === role ? '#0f6e56' : 'white',
                    color: user.role === role ? 'white' : '#113d35',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <label className="search-shell" htmlFor="report-search">
            <span>Search description</span>
            <input
              id="report-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title or description"
            />
          </label>

          <button
            type="button"
            className="report-link report-trigger"
            onClick={() => setIsReportModalOpen(true)}
          >
            Report Issue
          </button>
        </div>
      </header>

      <StatsBar stats={summaryStats} />

      {errorMessage ? (
        <div className="error-banner">
          <strong>Backend connection issue</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {userRole === "admin" ? (
        <AdminDashboard 
          allReports={reports}
          loading={loading}
          hotspots={hotspots}
          getImageUrl={getImageUrl}
          formatLocationLabel={formatLocationLabel}
        />
      ) : userRole === "officer" ? (
        <OfficerDashboard 
          user={user}
          allReports={reports}
          loading={loading}
          hotspots={hotspots}
          getImageUrl={getImageUrl}
          formatDateLabel={formatDateLabel}
          formatLocationLabel={formatLocationLabel}
          onActionComplete={(id, type) => {
            if (type === 'resolve') handleResolve(id);
            if (type === 'assign') {
              handleAssign(id, user.officerId);
            }
          }}
        />
      ) : (
        <section
          ref={layoutRef}
          className={`dashboard-main ${isResizing ? "is-resizing" : ""}`}
          style={{ "--map-width": `${mapWidth}%` }}
        >
          <div className="map-panel">
            <div className="panel-head">
              <div>
                <span className="panel-eyebrow">Map view</span>
                <h2>Interactive map</h2>
              </div>

              <div className="panel-tools">
                <span className="tool-pill active">40 / 60 default</span>
                {isResetVisible ? (
                  <button
                    type="button"
                    className="tool-button"
                    onClick={() => setMapWidth(DEFAULT_MAP_WIDTH)}
                  >
                    Reset split
                  </button>
                ) : null}
              </div>
            </div>

            <div className="map-surface">
              <ReportsMap
                markers={markers}
                hotspots={hotspots}
                selectedReportId={activeSelectedReportId}
                onSelectReport={setSelectedReportId}
                getImageUrl={getImageUrl}
              />

              {loading ? (
                <div className="map-loading-overlay">
                  <span className="loader-ring" />
                  <p>Loading map data...</p>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="resize-rail"
            onMouseDown={() => setIsResizing(true)}
            aria-label="Resize map and report list panels"
          >
            <span />
            <span />
            <span />
          </button>

          <aside className="list-panel">
            <div className="panel-head list-head">
              <div>
                <span className="panel-eyebrow">Report queue</span>
                <h2>Road Reports</h2>
              </div>

              <div className="list-actions">
                <label className="sort-shell" htmlFor="sort-reports">
                  <span>Sort</span>
                  <select
                    id="sort-reports"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="status">By status</option>
                  </select>
                </label>

                {(userRole === "officer" || userRole === "admin") && (
                  <label className="officer-shell" htmlFor="assign-officer-id">
                    <span>Officer ID</span>
                    <input
                      id="assign-officer-id"
                      type="text"
                      value={assignmentOfficerId}
                      onChange={(event) => setAssignmentOfficerId(event.target.value)}
                      placeholder="Required for assign"
                    />
                  </label>
                )}
              </div>
            </div>

            {(userRole === "officer" || userRole === "admin") && (
              <p className="assignment-hint">
                Assign actions use the officer ID entered above.
              </p>
            )}

            <div className="filter-row" role="tablist" aria-label="Status filters">
              {STATUS_FILTERS.map((filterValue) => (
                <button
                  key={filterValue}
                  type="button"
                  className={`filter-chip ${
                    statusFilter === filterValue ? "active" : ""
                  }`}
                  onClick={() => setStatusFilter(filterValue)}
                >
                  {filterValue === "all"
                    ? "All"
                    : filterValue.charAt(0).toUpperCase() + filterValue.slice(1)}
                </button>
              ))}
            </div>

            <div className="results-meta">
              <p>
                Showing <strong>{filteredReports.length}</strong> of{" "}
                <strong>{reports.length}</strong> reports
              </p>
              <span className="results-hint">
                Click any card to zoom and open its map popup.
              </span>
            </div>

            <ReportList
              reports={filteredReports}
              loading={loading}
              selectedReportId={activeSelectedReportId}
              markerLookup={markerLookup}
              actionLoading={actionLoading}
              assignmentOfficerId={assignmentOfficerId}
              userRole={userRole}
              onSelectReport={setSelectedReportId}
              onAssign={handleAssign}
              onResolve={handleResolve}
              getImageUrl={getImageUrl}
              formatDateLabel={formatDateLabel}
              formatLocationLabel={formatLocationLabel}
            />
          </aside>
        </section>
      )}

      {isReportModalOpen ? (
        <div
          className="report-modal-overlay"
          onClick={() => setIsReportModalOpen(false)}
          role="presentation"
        >
          <div
            className="report-modal-shell"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Report a pothole"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setIsReportModalOpen(false)}
              aria-label="Close report form"
            >
              x
            </button>

            <ReportForm mode="modal" onSubmitted={handleReportCreated} />
          </div>
        </div>
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default Dashboard;
