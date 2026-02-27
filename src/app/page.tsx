const endpointGroups = [
  {
    title: "Auth",
    summary: "Session login/logout and identity retrieval.",
    endpoints: ["POST /api/auth/login", "POST /api/auth/logout", "GET /api/me"]
  },
  {
    title: "Assets",
    summary: "Serialized asset catalog and bulk ingest.",
    endpoints: [
      "GET /api/assets",
      "POST /api/assets",
      "GET /api/assets/:id",
      "PATCH /api/assets/:id",
      "POST /api/assets/import"
    ]
  },
  {
    title: "Reservations",
    summary: "Availability checks, reservation CRUD, and calendar views.",
    endpoints: [
      "POST /api/availability/check",
      "GET /api/calendar",
      "GET /api/reservations",
      "POST /api/reservations",
      "PATCH /api/reservations/:id",
      "POST /api/reservations/:id/cancel"
    ]
  },
  {
    title: "Checkouts",
    summary: "Scan-gated checkout/check-in workflow with override path.",
    endpoints: [
      "GET /api/checkouts",
      "POST /api/checkouts",
      "POST /api/checkouts/:id/start-scan-session",
      "POST /api/checkouts/:id/scan",
      "POST /api/checkouts/:id/complete-checkout",
      "POST /api/checkouts/:id/checkin-scan",
      "POST /api/checkouts/:id/complete-checkin",
      "POST /api/checkouts/:id/admin-override"
    ]
  },
  {
    title: "Bulk Inventory",
    summary: "Bulk SKU pools and quantity adjustments.",
    endpoints: ["GET /api/bulk-skus", "POST /api/bulk-skus", "POST /api/bulk-skus/:id/adjust"]
  }
];

const highlights = [
  "Serialized reservation conflict prevention",
  "QR scan enforcement on checkout + check-in",
  "Bulk inventory pools with quantity tracking"
];

export default function HomePage() {
  const totalEndpoints = endpointGroups.reduce((count, group) => count + group.endpoints.length, 0);

  return (
    <main className="container">
      <section className="hero">
        <p className="eyebrow">Gearflow v1</p>
        <h1>Camera gear operations, API-first.</h1>
        <p className="lead">
          Backend foundation for reservations, checkout/check-in scan enforcement, and bulk inventory pools.
        </p>
        <div className="stats" role="list" aria-label="API coverage summary">
          <div className="stat" role="listitem">
            <strong>{totalEndpoints}</strong>
            <span>Implemented endpoints</span>
          </div>
          <div className="stat" role="listitem">
            <strong>{endpointGroups.length}</strong>
            <span>Capability domains</span>
          </div>
          <div className="stat" role="listitem">
            <strong>2-layer</strong>
            <span>Serialized conflict guard</span>
          </div>
        </div>
      </section>

      <section>
        <h2>Platform Highlights</h2>
        <ul className="highlights">
          {highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Implemented Endpoints</h2>
        <div className="endpoint-grid">
          {endpointGroups.map((group) => (
            <article className="endpoint-card" key={group.title}>
              <h3>{group.title}</h3>
              <p>{group.summary}</p>
              <ul>
                {group.endpoints.map((endpoint) => (
                  <li key={endpoint}>{endpoint}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
