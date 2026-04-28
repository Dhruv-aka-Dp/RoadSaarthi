import React, { memo } from "react";
import StatusBadge from "./StatusBadge";

const getPriorityLabel = (priority) => {
  if (priority === 'high') return '🔴 High Priority';
  if (priority === 'medium') return '🟡 Medium Priority';
  return '🟢 Low Priority';
};

const ReportList = memo(function ReportList({
  reports,
  loading,
  selectedReportId,
  markerLookup,
  actionLoading,
  assignmentOfficerId,
  userRole,
  onSelectReport,
  onAssign,
  onResolve,
  getImageUrl,
  formatDateLabel,
  formatLocationLabel,
}) {
  if (loading) {
    return (
      <div className="report-list">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`skeleton-${index}`} className="report-card skeleton-card">
            <div className="thumb-skeleton" />
            <div className="card-copy">
              <span className="line short" />
              <span className="line long" />
              <span className="line medium" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!reports.length) {
    return (
      <div className="report-list">
        <div className="empty-list-state">
          <h3>No reports match these filters</h3>
          <p>Try changing the search text or status filter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-list">
      {reports.map((report) => {
        const imageUrl = getImageUrl(report.image);
        const isSelected = report._id === selectedReportId;
        const markerMeta = markerLookup.get(report._id);
        const isAssignLoading =
          actionLoading?.type === "assign" && actionLoading.id === report._id;
        const isResolveLoading =
          actionLoading?.type === "resolve" && actionLoading.id === report._id;

        return (
          <article
            key={report._id}
            className={`report-card ${isSelected ? "selected" : ""}`}
          >
            <button
              type="button"
              className="report-card-main"
              onClick={() => onSelectReport(report._id)}
            >
              <div className="report-thumb">
                {imageUrl ? (
                  <img src={imageUrl} alt={report.title} />
                ) : (
                  <div className={`thumb-placeholder placeholder-${report.status}`}>
                    <span>{report.title.slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
              </div>

              <div className="card-body">
                <div className="card-topline">
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                    <StatusBadge status={report.status} />
                    {report.priority && report.priority !== 'low' && (
                      <span className="priority-badge" style={{fontSize: '0.75rem', fontWeight: 600}}>
                        {getPriorityLabel(report.priority)}
                      </span>
                    )}
                  </div>
                  <span className="card-time">
                    {formatDateLabel(report.createdAt)}
                  </span>
                </div>

                <h3>{report.title}</h3>
                <p>{report.description}</p>

                <div className="card-footer">
                  <span>{formatLocationLabel(report)}</span>
                  <span>
                    Zoom on map
                  </span>
                </div>
              </div>
            </button>

            {(userRole === "officer" || userRole === "admin") && (
              <div className="card-actions">
                <button
                  type="button"
                  className="card-action secondary"
                  onClick={() => onAssign(report._id)}
                  disabled={
                    !assignmentOfficerId.trim() ||
                    report.status === "resolved" ||
                    isAssignLoading
                  }
                >
                  {isAssignLoading
                    ? "Assigning..."
                    : report.status === "assigned"
                      ? "Reassign"
                      : "Assign"}
                </button>

                <button
                  type="button"
                  className="card-action primary"
                  onClick={() => onResolve(report._id)}
                  disabled={report.status === "resolved" || isResolveLoading}
                >
                  {isResolveLoading ? "Updating..." : "Mark Resolved"}
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
});

export default ReportList;
