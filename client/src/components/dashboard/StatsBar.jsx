function StatsBar({ stats }) {
  return (
    <section className="summary-strip" aria-label="Dashboard summary">
      {stats.map((stat) => (
        <article key={stat.label} className={`summary-card summary-${stat.tone}`}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
        </article>
      ))}
    </section>
  );
}

export default StatsBar;
