"use client";

import { useEffect, useState } from "react";

type Asset = {
  id: string;
  assetTag: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  location: { name: string };
};

type Response = {
  data: Asset[];
  total: number;
  limit: number;
  offset: number;
};

const statusBadge: Record<string, string> = {
  AVAILABLE: "badge-green",
  MAINTENANCE: "badge-orange",
  RETIRED: "badge-gray",
};

export default function ItemsPage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/assets?${params}`)
      .then((res) => res.json())
      .then((json: Response) => {
        setItems(json.data);
        setTotal(json.total);
      })
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  async function reload() {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/assets?${params}`);
    const json: Response = await res.json();
    setItems(json.data);
    setTotal(json.total);
  }

  async function handleAddItem() {
    const locationRes = await fetch("/api/form-options");
    const locationJson = await locationRes.json();
    const locations: Array<{ id: string; name: string }> = locationJson.data.locations;

    if (locations.length === 0) {
      alert("No active locations found. Create a location first.");
      return;
    }

    const assetTag = window.prompt("Asset tag");
    if (!assetTag) return;
    const brand = window.prompt("Brand", "Unknown") || "Unknown";
    const model = window.prompt("Model", "Unknown") || "Unknown";
    const type = window.prompt("Type", "equipment") || "equipment";
    const serialNumber = window.prompt("Serial number") || `manual-${Date.now()}`;
    const qrCodeValue = window.prompt("QR code value", serialNumber) || serialNumber;
    const locationNameList = locations.map((l) => l.name).join(", ");
    const selectedLocationName = window.prompt(`Location (${locationNameList})`, locations[0].name);
    const locationId = locations.find((l) => l.name === selectedLocationName)?.id ?? locations[0].id;

    setSubmitting(true);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetTag, brand, model, type, serialNumber, qrCodeValue, locationId })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create item");
      }

      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Items</h1>
        <button className="btn btn-primary" onClick={handleAddItem} disabled={submitting}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          {submitting ? "Saving..." : "Add item"}
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ gap: 12 }}>
          <input
            type="text"
            placeholder="Search by tag, brand, model, serial..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            style={{
              flex: 1,
              padding: "7px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              outline: "none",
              fontSize: 13,
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            style={{
              padding: "7px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              background: "white",
            }}
          >
            <option value="">All statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">No items found</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Brand / Model</th>
                  <th>Type</th>
                  <th>Serial Number</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.assetTag}</td>
                    <td>{item.brand} {item.model}</td>
                    <td>{item.type}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{item.serialNumber}</td>
                    <td>{item.location.name}</td>
                    <td>
                      <span className={`badge ${statusBadge[item.status] || "badge-gray"}`}>
                        {item.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="pagination">
                <span>Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</span>
                <div className="pagination-btns">
                  <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
