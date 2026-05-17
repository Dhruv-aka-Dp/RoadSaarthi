import React, { useEffect, useState, useMemo } from "react";
import ReportsMap from "./ReportsMap";
import StatsBar from "./StatsBar";
import API from "../../services/api";

function AdminDashboard({ 
  allReports, 
  loading, 
  hotspots, 
  getImageUrl, 
  formatLocationLabel,
  onAssign,
  onResolve
}) {
  const [officerMetrics, setOfficerMetrics] = useState([]);
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(true);

  const [showOfficerModal, setShowOfficerModal] = useState(false);
  const [newOfficer, setNewOfficer] = useState({ name: "", email: "" });

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

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const officers = useMemo(() => {
    return users.filter(u => u.role === "officer");
  }, [users]);

  const getOfficerName = (offId) => {
    const found = officers.find(o => o.officerId === offId);
    return found ? found.name : offId;
  };

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

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    if (!newOfficer.name || !newOfficer.email) return;

    try {
      const generatedOfficerId = `OFF-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Register new officer in the live database
      await API.post("/auth/register", {
        name: newOfficer.name,
        email: newOfficer.email,
        password: "Password123", // default secure password
        role: "officer",
        officerId: generatedOfficerId
      });

      // Reload live users list
      fetchUsers();
      setNewOfficer({ name: "", email: "" });
      setShowOfficerModal(false);
    } catch (err) {
      console.error("Failed to register officer:", err);
      alert(err.response?.data?.error || "Failed to register officer in the database.");
    }
  };

  const handleToggleUserStatus = (id) => {
    setUsers(users.map(u => u._id === id ? { ...u, isInactive: !u.isInactive } : u));
  };

  return (
    <div className="admin-dashboard">
      <StatsBar stats={systemStats} />

      {/* Manage & Assign Reports section - Full-width, placed above Hotspot Monitoring map */}
      <div className="users-section" style={{ marginBottom: '30px', marginTop: '20px' }}>
        <div className="section-header directory-header">
          <div>
            <span className="panel-eyebrow">Report Management</span>
            <h3>Manage & Assign Reports</h3>
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
                <th>Assigned To</th>
                <th>Action / Assignment</th>
              </tr>
            </thead>
            <tbody>
              {allReports.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    No reports available in the database.
                  </td>
                </tr>
              ) : (
                allReports.map((report) => (
                  <tr key={report._id}>
                    <td className="user-name">
                      <strong style={{ display: 'block', fontSize: '14px', color: '#113d35' }}>{report.title}</strong>
                      <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>{report.description}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#555' }}>
                      {formatLocationLabel(report)}
                    </td>
                    <td>
                      <span className="priority-badge" style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: report.priority === 'high' ? '#ffebeb' : report.priority === 'medium' ? '#fff6e6' : '#effaf6',
                        color: report.priority === 'high' ? '#d93838' : report.priority === 'medium' ? '#e67e22' : '#2ecc71'
                      }}>
                        {(report.priority || 'low').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`status-indicator status-${report.status}`} style={{ textTransform: 'capitalize' }}>
                        {report.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600', color: report.assignedTo ? '#0f6e56' : '#888', fontSize: '13px' }}>
                      {report.assignedTo ? (
                        <span>👤 {getOfficerName(report.assignedTo)} ({report.assignedTo})</span>
                      ) : report.status === 'resolved' ? (
                        <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>✔️ N/A (Closed)</span>
                      ) : (
                        '⚠️ Unassigned'
                      )}
                    </td>
                    <td>
                      {report.status === 'resolved' ? (
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: '#effaf6',
                          color: '#2ecc71',
                          display: 'inline-block'
                        }}>
                          ✔️ Case Resolved
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select
                            id={`assign-select-${report._id}`}
                            defaultValue={report.assignedTo || ""}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid rgba(17,61,53,0.15)',
                              background: '#fff',
                              fontSize: '12px',
                              color: '#113d35',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">-- Choose Officer --</option>
                            {officers.map(off => (
                              <option key={off._id} value={off.officerId}>
                                {off.name} ({off.officerId})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const selectEl = document.getElementById(`assign-select-${report._id}`);
                              const selectedOffId = selectEl ? selectEl.value : "";
                              if (selectedOffId) {
                                onAssign(report._id, selectedOffId);
                              }
                            }}
                            className="btn-action-toggle"
                            style={{
                              padding: '6px 12px',
                              background: '#0f6e56',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
                          >
                            Assign
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    <strong>Officer: {getOfficerName(metric.officerId)}</strong>
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

      {/* User Directory section - Full width at the bottom */}
      <div className="users-section" style={{ marginTop: '30px' }}>
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
              {userLoading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    Loading system accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    No system accounts found.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u._id}>
                    <td className="user-name">{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`role-badge role-${u.role}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-indicator status-${u.isInactive ? 'inactive' : 'active'}`}>
                        {u.isInactive ? '● Inactive' : '● Active'}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleToggleUserStatus(u._id)}
                        className="btn-action-toggle"
                      >
                        {u.isInactive ? 'Activate' : 'Deactivate'}
                      </button>
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
