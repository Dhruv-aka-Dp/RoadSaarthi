import { useEffect, useMemo, useState } from "react";
import ReportsMap from "./ReportsMap";
import StatsBar from "./StatsBar";
import API from "../../services/api";

const formatLocationSourceLabel = (key) => {
  if (key === "browser") return "Browser GPS";
  if (key === "exif") return "Photo EXIF";
  if (key === "manual") return "Manual GPS";
  return "Unknown";
};

function AdminDashboard({
  allReports,
  hotspots,
  getImageUrl,
  formatLocationLabel,
  onAssign,
  onResolve,
}) {
  const [analytics, setAnalytics] = useState({
    locationSource: {},
    dailyVolume: [],
    assignmentBreakdown: [],
    hotspots: [],
  });
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(true);
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [showOfficerModal, setShowOfficerModal] = useState(false);
  const [newOfficer, setNewOfficer] = useState({ name: "", email: "" });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setUserLoading(true);
        const res = await API.get("/auth/users");
        setUsers(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setUserLoading(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await API.get("/reports/analytics");
        setAnalytics(res.data.data || {});
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      }
    };

    fetchAnalytics();
  }, [allReports]);

  useEffect(() => {
    setAssignmentDrafts((current) => {
      const next = { ...current };

      allReports.forEach((report) => {
        if (!(report._id in next)) {
          next[report._id] = report.assignedTo || "";
        }
      });

      return next;
    });
  }, [allReports]);

  const officers = useMemo(
    () => users.filter((user) => user.role === "officer"),
    [users]
  );

  const getOfficerName = (officerId) => {
    const foundOfficer = officers.find((officer) => officer.officerId === officerId);
    return foundOfficer ? foundOfficer.name : officerId;
  };

  const systemStats = useMemo(() => {
    const total = allReports.length;
    const pending = allReports.filter((report) => report.status === "pending").length;
    const assigned = allReports.filter((report) => report.status === "assigned").length;
    const resolved = allReports.filter((report) => report.status === "resolved").length;

    return [
      { label: "Total Submissions", value: total, tone: "neutral" },
      { label: "Pending Investigation", value: pending, tone: "pending" },
      { label: "Assigned To Field", value: assigned, tone: "assigned" },
      { label: "Issues Resolved", value: resolved, tone: "resolved" },
    ];
  }, [allReports]);

  const markers = useMemo(() => {
    return allReports
      .filter(
        (report) =>
          report.location &&
          Array.isArray(report.location.coordinates) &&
          report.location.coordinates.length >= 2
      )
      .map((report) => ({
        id: report._id,
        lat: report.location.coordinates[1],
        lng: report.location.coordinates[0],
        status: report.status,
        priority: report.priority,
        report,
      }));
  }, [allReports]);

  const locationSourceEntries = useMemo(() => {
    return Object.entries(analytics.locationSource || {}).sort(
      (left, right) => right[1] - left[1]
    );
  }, [analytics.locationSource]);

  const handleCreateOfficer = async (event) => {
    event.preventDefault();

    if (!newOfficer.name || !newOfficer.email) {
      return;
    }

    try {
      const generatedOfficerId = `OFF-${Math.floor(1000 + Math.random() * 9000)}`;

      await API.post("/auth/register", {
        name: newOfficer.name,
        email: newOfficer.email,
        password: "Password123",
        role: "officer",
        officerId: generatedOfficerId,
      });

      const usersResponse = await API.get("/auth/users");
      setUsers(usersResponse.data.data || []);
      setNewOfficer({ name: "", email: "" });
      setShowOfficerModal(false);
    } catch (err) {
      console.error("Failed to register officer:", err);
      alert(
        err.response?.data?.error ||
          "Failed to register officer in the database."
      );
    }
  };

  return (
    <div className="admin-dashboard">
      <StatsBar stats={systemStats} />

      <div className="users-section" style={{ marginBottom: "30px", marginTop: "20px" }}>
        <div className="section-header directory-header">
          <div>
            <span className="panel-eyebrow">Report Management</span>
            <h3>Secure Assignment Workflow</h3>
          </div>
        </div>

        <div className="directory-table-wrapper">
          <table className="directory-table">
            <thead>
              <tr>
                <th>Report Info</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Status</th>
                <th>GPS Source</th>
                <th>Assigned To</th>
                <th>Action / Assignment</th>
              </tr>
            </thead>
            <tbody>
              {allReports.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                    No reports available in the database.
                  </td>
                </tr>
              ) : (
                allReports.map((report) => {
                  const selectedOfficerId =
                    assignmentDrafts[report._id] ?? report.assignedTo ?? "";

                  return (
                    <tr key={report._id}>
                      <td className="user-name">
                        <strong
                          style={{
                            display: "block",
                            fontSize: "14px",
                            color: "#113d35",
                          }}
                        >
                          {report.title}
                        </strong>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            fontWeight: "normal",
                          }}
                        >
                          {report.description}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "#555" }}>
                        {formatLocationLabel(report)}
                      </td>
                      <td>
                        <span
                          className="priority-badge"
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            background:
                              report.priority === "high"
                                ? "#ffebeb"
                                : report.priority === "medium"
                                  ? "#fff6e6"
                                  : "#effaf6",
                            color:
                              report.priority === "high"
                                ? "#d93838"
                                : report.priority === "medium"
                                  ? "#e67e22"
                                  : "#2ecc71",
                          }}
                        >
                          {(report.priority || "low").toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-indicator status-${report.status}`}
                          style={{ textTransform: "capitalize" }}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "#56736b", fontWeight: 600 }}>
                        {formatLocationSourceLabel(report.locationSource)}
                      </td>
                      <td
                        style={{
                          fontWeight: "600",
                          color: report.assignedTo ? "#0f6e56" : "#888",
                          fontSize: "13px",
                        }}
                      >
                        {report.assignedTo ? (
                          <span>
                            {getOfficerName(report.assignedTo)} ({report.assignedTo})
                          </span>
                        ) : report.status === "resolved" ? (
                          <span style={{ color: "#2ecc71", fontWeight: "bold" }}>
                            Closed
                          </span>
                        ) : (
                          "Unassigned"
                        )}
                      </td>
                      <td>
                        {report.status === "resolved" ? (
                          <span
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "bold",
                              background: "#effaf6",
                              color: "#2ecc71",
                              display: "inline-block",
                            }}
                          >
                            Case Resolved
                          </span>
                        ) : (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <select
                              value={selectedOfficerId}
                              onChange={(event) =>
                                setAssignmentDrafts((current) => ({
                                  ...current,
                                  [report._id]: event.target.value,
                                }))
                              }
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid rgba(17,61,53,0.15)",
                                background: "#fff",
                                fontSize: "12px",
                                color: "#113d35",
                                cursor: "pointer",
                              }}
                            >
                              <option value="">-- Choose Officer --</option>
                              {officers.map((officer) => (
                                <option key={officer._id} value={officer.officerId}>
                                  {officer.name} ({officer.officerId})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() =>
                                selectedOfficerId && onAssign(report._id, selectedOfficerId)
                              }
                              className="btn-action-toggle"
                              style={{
                                padding: "6px 12px",
                                background: "#0f6e56",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "bold",
                                cursor: selectedOfficerId ? "pointer" : "not-allowed",
                                opacity: selectedOfficerId ? 1 : 0.55,
                              }}
                              disabled={!selectedOfficerId}
                            >
                              {report.status === "assigned" ? "Reassign" : "Assign"}
                            </button>
                            <button
                              onClick={() => onResolve(report._id)}
                              className="btn-action-toggle"
                              style={{
                                padding: "6px 12px",
                                background: "#124b40",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "bold",
                                cursor: "pointer",
                              }}
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-main">
          <div className="section-header">
            <span className="panel-eyebrow">Real-Time Heatmap</span>
            <h2>Bucketed Hotspot Monitoring</h2>
          </div>

          <div className="map-surface admin-map">
            <ReportsMap
              markers={markers}
              hotspots={hotspots}
              getImageUrl={getImageUrl}
            />
          </div>

          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="section-header">
                <span className="panel-eyebrow">Facet Output</span>
                <h3>Location Source Breakdown</h3>
              </div>

              <div className="source-breakdown-list">
                {locationSourceEntries.length ? (
                  locationSourceEntries.map(([source, count]) => (
                    <div key={source} className="source-breakdown-item">
                      <span>{formatLocationSourceLabel(source)}</span>
                      <strong>{count}</strong>
                    </div>
                  ))
                ) : (
                  <div className="empty-state-box">
                    No location-source analytics available yet.
                  </div>
                )}
              </div>
            </div>

            <div className="analytics-card">
              <div className="section-header">
                <span className="panel-eyebrow">Facet Output</span>
                <h3>7-Day Volume Trend</h3>
              </div>

              <div className="trend-list">
                {(analytics.dailyVolume || []).length ? (
                  analytics.dailyVolume.map((point) => {
                    const maxCount = Math.max(
                      1,
                      ...(analytics.dailyVolume || []).map((entry) => entry.count)
                    );

                    return (
                      <div key={point.date} className="trend-row">
                        <span>{point.date.slice(5)}</span>
                        <div className="trend-bar-shell">
                          <div
                            className="trend-bar-fill"
                            style={{
                              width: `${(point.count / maxCount) * 100}%`,
                            }}
                          />
                        </div>
                        <strong>{point.count}</strong>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state-box">
                    No daily trend data available yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-side">
          <div className="section-header">
            <span className="panel-eyebrow">Performance Hub</span>
            <h3>Officer Analytics</h3>
          </div>

          <div className="officer-metrics-list">
            {(analytics.assignmentBreakdown || []).length > 0 ? (
              analytics.assignmentBreakdown.map((metric) => (
                <div key={metric.officerId} className="officer-metric-card">
                  <div className="metric-header">
                    <strong>Officer: {getOfficerName(metric.officerId)}</strong>
                    <span className="metric-rate">
                      {metric.resolutionRate.toFixed(0)}% Resolved
                    </span>
                  </div>
                  <div className="metric-stats">
                    <div>
                      Assigned: <strong>{metric.totalAssigned}</strong>
                    </div>
                    <div>
                      Pending: <strong>{metric.pending}</strong>
                    </div>
                    <div>
                      Resolved: <strong>{metric.resolved}</strong>
                    </div>
                  </div>
                  <div className="metric-alert-line">
                    High-priority open cases: <strong>{metric.highPriorityOpen}</strong>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state-box">
                No active assignments tracked.
              </div>
            )}
          </div>

          <div className="critical-zones">
            <div className="section-header">
              <span className="panel-eyebrow">Hotspot Alarms</span>
              <h3>Critical Zones</h3>
            </div>

            <div className="critical-zones-list">
              {(analytics.hotspots || hotspots).map((hotspot, index) => (
                <div key={hotspot.zoneId || index} className="critical-zone-card">
                  <div className="zone-info">
                    <strong className="zone-title">
                      Zone {hotspot.zoneId ?? index + 1}
                    </strong>
                    <div className="zone-coords">
                      Lat {hotspot.lat.toFixed(3)} / Lng {hotspot.lng.toFixed(3)}
                    </div>
                    <div className="zone-coords">
                      Severity: {(hotspot.severity || "low").toUpperCase()}
                    </div>
                  </div>
                  <span className="zone-count-badge">{hotspot.count} Reports</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="users-section" style={{ marginTop: "30px" }}>
        <div className="section-header directory-header">
          <div>
            <span className="panel-eyebrow">User Directory</span>
            <h3>System Accounts</h3>
          </div>
          <button
            onClick={() => setShowOfficerModal(true)}
            className="btn-register"
          >
            Register Officer
          </button>
        </div>

        <div className="directory-table-wrapper">
          <table className="directory-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Officer ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {userLoading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                    Loading system accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                    No system accounts found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id}>
                    <td className="user-name">{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`role-badge role-${user.role}`}>{user.role}</span>
                    </td>
                    <td>{user.officerId || "-"}</td>
                    <td>
                      <span className="status-indicator status-active">Active</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showOfficerModal && (
        <div className="modal-overlay">
          <div className="modal-shell">
            <h3>Register New Officer</h3>
            <form onSubmit={handleCreateOfficer} className="modal-form">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newOfficer.name}
                  onChange={(event) =>
                    setNewOfficer((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newOfficer.email}
                  onChange={(event) =>
                    setNewOfficer((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowOfficerModal(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
