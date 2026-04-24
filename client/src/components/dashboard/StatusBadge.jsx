function StatusBadge({ status }) {
  const normalizedStatus = status || "pending";
  const label =
    normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);

  return (
    <span className={`status-badge status-${normalizedStatus}`}>{label}</span>
  );
}

export default StatusBadge;
