import React, { useEffect, useState, useMemo } from "react";
import ReportsMap from "./ReportsMap";
import ReportList from "./ReportList";
import StatsBar from "./StatsBar";
import API from "../../services/api";

function OfficerDashboard({ 
  user, 
  allReports, 
  loading, 
  hotspots, 
  onActionComplete,
  getImageUrl,
  formatDateLabel,
  formatLocationLabel
}) {
  const [stats, setStats] = useState({
    totalAssigned: 0,
    pendingForOfficer: 0,
    resolved: 0,
    resolvedToday: 0,
    resolutionPercentage: 0
  });

  const officerId = user?.officerId || "OFF-001"; // Default for demo

  useEffect(() => {
    const fetchOfficerStats = async () => {
      try {
        const res = await API.get(`/reports/officer-stats/${officerId}`);
        setStats(res.data.data);
      } catch (err) {
        console.error("Failed to fetch officer stats:", err);
      }
    };

    if (officerId) fetchOfficerStats();
  }, [officerId, allReports]);

  // Filter reports assigned to this officer
  const assignedReports = useMemo(() => {
    return allReports.filter(r => r.assignedTo === officerId);
  }, [allReports, officerId]);

  // High priority queue
  const priorityQueue = useMemo(() => {
    return assignedReports.filter(r => r.priority === 'high' && r.status !== 'resolved');
  }, [assignedReports]);

  const summaryStats = [
    { label: "Assigned To Me", value: stats.totalAssigned, tone: "assigned" },
    { label: "Pending Tasks", value: stats.pendingForOfficer, tone: "pending" },
    { label: "Resolved Today", value: stats.resolvedToday, tone: "resolved" },
    { label: "Success Rate", value: `${stats.resolutionPercentage}%`, tone: "neutral" },
  ];

  const markers = assignedReports.map(report => ({
    id: report._id,
    lat: report.location.coordinates[1],
    lng: report.location.coordinates[0],
    status: report.status,
    priority: report.priority,
    report: report
  }));

  return (
    <div className="officer-dashboard">
      <StatsBar stats={summaryStats} />
      
      <div className="dashboard-grid">
        <div className="main-content">
          <div className="section-header">
            <span className="panel-eyebrow">On-Field Task View</span>
            <h2>Your Assigned Route</h2>
          </div>
          
          <div className="map-surface officer-map">
            <ReportsMap 
              markers={markers} 
              hotspots={hotspots}
              getImageUrl={getImageUrl}
            />
          </div>

          <div className="priority-queue-section">
            <div className="section-header priority-header">
              <span className="critical-badge">CRITICAL</span>
              <h3>High Priority Queue</h3>
            </div>
            {priorityQueue.length > 0 ? (
              <div className="priority-list">
                {priorityQueue.map(report => (
                  <div key={report._id} className="priority-item-card">
                    <h4>{report.title}</h4>
                    <p>{report.description}</p>
                    <div className="location-label">{formatLocationLabel(report)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-box">
                No critical issues in your queue. Great job!
              </div>
            )}
          </div>
        </div>

        <aside className="task-list-sidebar">
          <div className="section-header">
            <span className="panel-eyebrow">Task List</span>
            <h3>Active Assignments</h3>
          </div>
          
          <div className="report-list-container">
            <ReportList 
              reports={assignedReports}
              loading={loading}
              userRole="officer"
              onResolve={(id) => onActionComplete(id, 'resolve')}
              onAssign={(id) => onActionComplete(id, 'assign')}
              getImageUrl={getImageUrl}
              formatDateLabel={formatDateLabel}
              formatLocationLabel={formatLocationLabel}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default OfficerDashboard;
