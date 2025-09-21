
"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
export default function OpeningsLayout() {
  const router = useRouter();
  const [openings, setOpenings] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchOpenings = async (page = 1) => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/vendor/openings?page=${page}&limit=10`,
        {
          method: "GET",
          credentials: "include", // 👈 sends cookies/token
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch openings");

      const data = await res.json();
      setOpenings(data.openings || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Error fetching openings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenings(1);
  }, []);

  return (
    <div className="p-6 bg-background text-foreground min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Contract Openings</h1>

      {/* ✅ Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-tableHeader">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-primary">Title</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-primary">Location</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-primary">Contract Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-primary">Posted Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-primary">Hiring Manager</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-sm text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : openings.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-sm text-muted-foreground">
                  No openings found.
                </td>
              </tr>
            ) : (
              openings.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/vendor/openings/${o.id}`)} // 👈 row click
                >
                  <td className="px-4 py-4 text-sm">{o.title}</td>
                  <td className="px-4 py-4 text-sm">{o.location}</td>
                  <td className="px-4 py-4 text-sm">{o.contractType}</td>
                  <td className="px-4 py-4 text-sm">
                    {o.postedDate ? new Date(o.postedDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <span className="text-foreground">{o.hiringManager?.name}</span>
                    <div className="text-[11px] text-muted-foreground">
                      {o.hiringManager?.email}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Pagination Controls */}
      {pagination && (
        <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
          <span>
            Showing {(pagination.currentPage - 1) * pagination.itemsPerPage + 1}{" "}
            to{" "}
            {(pagination.currentPage - 1) * pagination.itemsPerPage + openings.length}{" "}
            of {pagination.totalItems} results
          </span>

          <div className="space-x-2">
            <button
              disabled={pagination.currentPage === 1}
              onClick={() => fetchOpenings(1)}
              className="px-3 py-1 rounded-md border border-border text-xs disabled:opacity-30"
            >
              Go Back
            </button>
            <button
              disabled={pagination.currentPage === 1}
              onClick={() => fetchOpenings(pagination.currentPage - 1)}
              className="px-3 py-1 rounded-md border border-border text-xs disabled:opacity-30"
            >
              Prev
            </button>
            <button
              disabled={
                pagination.currentPage === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => fetchOpenings(pagination.currentPage + 1)}
              className="px-3 py-1 rounded-md border border-border text-xs disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
