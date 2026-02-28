"use client";

import { useEffect, useState } from "react";

type BulkSku = {
  id: string;
  name: string;
  category: string;
  unit: string;
  binQrCodeValue: string;
  minThreshold: number;
  active: boolean;
  location?: { name: string };
  balances?: Array<{ onHandQuantity: number }>;
};

type Response = { data: BulkSku[]; total: number; limit: number; offset: number };

export default function BulkInventoryPage() {
  const [items, setItems] = useState<BulkSku[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    fetch(`/api/bulk-skus?${params}`)
      .then((res) => res.json())
      .then((json: Response) => { setItems(json.data); setTotal(json.total); })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="page-header">
        <h1>Bulk Inventory</h1>
        <button className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add SKU
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">No bulk SKUs found</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>On Hand</th>
                  <th>Min Threshold</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sku) => {
                  const onHand = sku.balances?.[0]?.onHandQuantity ?? 0;
                  const isLow = onHand <= sku.minThreshold && sku.minThreshold > 0;
                  return (
                    <tr key={sku.id}>
                      <td style={{ fontWeight: 500 }}>{sku.name}</td>
                      <td>{sku.category}</td>
                      <td>{sku.unit}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: isLow ? "var(--red)" : "inherit" }}>
                          {onHand}
                        </span>
                      </td>
                      <td>{sku.minThreshold}</td>
                      <td>
                        {isLow ? (
                          <span className="badge badge-orange">low stock</span>
                        ) : (
                          <span className="badge badge-green">in stock</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
