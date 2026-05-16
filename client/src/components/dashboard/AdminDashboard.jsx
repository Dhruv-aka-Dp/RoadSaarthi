import React, { useEffect, useState, useMemo } from "react";
import ReportsMap from "./ReportsMap";
import StatsBar from "./StatsBar";
import API from "../../services/api";

function AdminDashboard({ 
  allReports, 
  loading, 
  hotspots, 
  getImageUrl, 
  formatLocationLabel 
}) {
  const [officerMetrics, setOfficerMetrics] = useState([]);
  const [users, setUsers] = useState([
    { id: 1, name: "Arjun Mehta", email: "arjun@roadsarthi.com", role: "officer", status: "active" },
    { id: 2, name: "Priya Sharma", email: "priya@roadsarthi.com", role: "officer", status: "active" },
    { id: 3, name: "Rohan Das", email: "rohan@gmail.com", role: "user", status: "active" },
    { id: 4, name: "Neha Patil", email: "neha@gmail.com", role: "user", status: "inactive" },
  ]);

  const [showOfficerModal, setShowOfficerModal] = useState(false);
  const [newOfficer, setNewOfficer] = useState({ name: "", email: "" });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await API.get("/reports/admin/officer-metrics");
        setOfficerMetrics(res.data.data);
      } catch (err) {
        console.error("Failed to fetch admin metrics:", err);
      }
    };
    fetchMetrics();
  }, [allReports]);

  // Overall system stats
  const systemStats = useMemo(() => {
    const total = allReports.length;
    const pending = allReports.filter(r => r.status === "pending").length;
    const assigned = allReports.filter(r => r.status === "assigned").length;
    const resolved = allReports.filter(r => r.status === "resolved").length;
    return [
      { label: "Total Submissions", value: total, tone: "neutral" },
      { label: "Pending Investigation", value: pending, tone: "pending" },
      { label: "Assigned To Field", value: assigned, tone: "assigned" },
      { label: "Issues Resolved", value: resolved, tone: "resolved" },
    ];
  }, [allReports]);

  const markers = allReports.map(report => ({
    id: report._id,
    lat: report.location.coordinates[1],
    lng: report.location.coordinates[0],
    status: report.status,
    priority: report.priority,
    report: report
  }));

  const handleCreateOfficer = (e) => {
    e.preventDefault();
    if (!newOfficer.name || !newOfficer.email) return;

    // Simulate saving a new officer
    const officer = {
      id: users.length + 1,
      name: newOfficer.name,
      email: newOfficer.email,
      role: "officer",
      status: "active"
    };

    setUsers([...users, officer]);
    setNewOfficer({ name: "", email: "" });
    setShowOfficerModal(false);
  };

  const handleToggleUserStatus = (id) => {
    setUsers(users.map(u => u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u));
  };

  return (
    <div className="admin-dashboard">
      <StatsBar stats={systemStats} />

      <div className="admin-grid">
        <div className="admin-main">
          <div className="section-header">
            <span className="panel-eyebrow">Real-Time Heatmap</span>
            <h2>System-Wide Hotspot Monitoring</h2>
          </div>

          <div className="map-surface admin-map">
            <ReportsMap 
              markers={markers} 
              hotspots={hotspots}
              getImageUrl={getImageUrl}
            />
          </div>

          <div className="users-section">
            <div className="section-header directory-header">
              <div>
                <span className="panel-eyebrow">User Directory</span>
                <h3>System Accounts</h3>
              </div>
              <button 
                onClick={() => setShowOfficerModal(true)}
                className="btn-register"
              >
                + Register Officer
              </button>
            </div>

            <div className="directory-table-wrapper">
              <table className="directory-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="user-name">{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-badge role-${u.role}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-indicator status-${u.status}`}>
                          {u.status === 'active' ? '● Active' : '● Inactive'}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => handleToggleUserStatus(u.id)}
                          className="btn-action-toggle"
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="admin-side">
          <div className="section-header">
            <span className="panel-eyebrow">Performance Hub</span>
            <h3>Officer Analytics</h3>
          </div>

          <div className="officer-metrics-list">
            {officerMetrics.length > 0 ? (
              officerMetrics.map(metric => (
                <div key={metric.officerId} className="officer-metric-card">
                  <div className="metric-header">
                    <strong>Officer: {metric.officerId}</strong>
                    <span className="metric-rate">{metric.resolutionRate.toFixed(0)}% Resolved</span>
                  </div>
                  <div className="metric-stats">
                    <div>Assigned: <strong>{metric.totalAssigned}</strong></div>
                    <div>Pending: <strong>{metric.pending}</strong></div>
                    <div>Resolved: <strong>{metric.resolved}</strong></div>
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
              {hotspots.map((hotspot, idx) => (
                <div key={idx} className="critical-zone-card">
                  <div className="zone-info">
                    <strong className="zone-title">Zone {idx + 1}</strong>
                    <div className="zone-coords">Lat {hotspot.lat.toFixed(3)} / Lng {hotspot.lng.toFixed(3)}</div>
                  </div>
                  <span className="zone-count-badge">
                    {hotspot.count} Reports
                  </span>
                </div>
              ))}
            </div>
          </div>
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
                  onChange={e => setNewOfficer({ ...newOfficer, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  value={newOfficer.email} 
                  onChange={e => setNewOfficer({ ...newOfficer, email: e.target.value })}
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
                <button 
                  type="submit"
                  className="btn-save"
                >
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
