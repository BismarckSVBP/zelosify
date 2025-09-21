"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Upload, Eye, Trash2 } from "lucide-react";
import UploadModal from "./UploadModal";
import { Button } from "@/components/UI/shadcn/button";
import { toast, Toaster } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

// Helper to parse responses
async function parseResponse(res) {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return { ok: res.ok, status: res.status, data, text };
  } catch {
    return { ok: res.ok, status: res.status, data: null, text };
  }
}

export default function OpeningDetails() {
  const router = useRouter();
  const { id } = useParams();

  const [opening, setOpening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasUploadModalOpened = useRef(false);

  // Initial fetch (Version 2 logic)
  useEffect(() => {
    if (!id) return;

    const fetchOpeningOnce = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/vendor/openings/${id}`, {
          method: "GET",
          credentials: "include",
        });

        const parsed = await parseResponse(res);
        if (!parsed.ok) throw new Error(parsed.text || "Failed to fetch");

        const data = parsed.data;
        setOpening(data);
        setStatus(data.status || "PENDING");

        const profiles = (data.profiles || []).map((p) => ({
          id: p.id,
          filename:
            p.fileName ||
            p.filename ||
            (p.s3Key ? p.s3Key.split("/").pop() : ""),
          s3Key: p.s3Key || null,
          isDraft: p.isDraft ?? false,
        }));
        setUploadedFiles(profiles);
      } catch (err) {
        setError(err.message || "Failed to load opening");
      } finally {
        setLoading(false);
      }
    };

    fetchOpeningOnce();
  }, [id]);

  // Full fetch for re-sync (Version 1 logic)
  const fetchOpeningFull = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/vendor/openings/${id}`, {
        method: "GET",
        credentials: "include",
      });
      const parsed = await parseResponse(res);
      if (!parsed.ok) throw new Error(parsed.text || "Failed to fetch");
      const data = parsed.data;
      setOpening(data);
      setStatus(data.status || "PENDING");
      const profiles = (data.profiles || []).map((p) => ({
        id: p.id,
        filename:
          p.fileName || p.filename || (p.s3Key ? p.s3Key.split("/").pop() : ""),
        s3Key: p.s3Key || null,
        isDraft: p.isDraft ?? false,
      }));
      setUploadedFiles(profiles);
    } catch (err) {
      toast.error(err.message || "Failed to sync opening");
    } finally {
      setLoading(false);
    }
  };

  const handleUploaded = (newProfiles) => {
    if (hasUploadModalOpened.current) {
      // After modal is closed, re-fetch from backend
      fetchOpeningFull();
    } else {
      // First-time local append
      setUploadedFiles((prev) => [...prev, ...newProfiles]);
    }
  };

  const handleDelete = async (file) => {
    if (status === "SUBMITTED") {
      toast.error("Profiles cannot be deleted after submission.");
      return;
    }

    if (file.id) {
      try {
        const res = await fetch(
          `${API_BASE}/vendor/openings/${id}/profiles/delete/${file.id}`,
          { method: "POST", credentials: "include" }
        );
        const parsed = await parseResponse(res);
        if (!parsed.ok) {
          toast.error("Failed to delete profile: " + parsed.text);
          return;
        }
        // Update locally
        setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));
      } catch {
        toast.error("Error deleting profile");
      }
    } else {
      setUploadedFiles((prev) =>
        prev.filter(
          (f) => f.s3Key !== file.s3Key || f.filename !== file.filename
        )
      );
    }
  };

  const handleView = async (file) => {
    if (!file.s3Key) {
      toast.error("Preview not available (missing s3Key).");
      return;
    }

    try {
      const payload = {
        profiles: [{ s3Key: file.s3Key, filename: file.filename }],
      };
      const res = await fetch(
        `${API_BASE}/vendor/openings/${id}/profiles/view`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const parsed = await parseResponse(res);
      if (!parsed.ok) {
        toast.error("Failed to get preview URL: " + parsed.text);
        return;
      }

      const profiles =
        parsed.data?.data?.profiles || parsed.data?.data || parsed.data;
      const viewUrl = Array.isArray(profiles)
        ? profiles[0]?.viewUrl
        : profiles?.viewUrl;
      if (!viewUrl) {
        toast.error("Preview URL not returned by server.");
        return;
      }
      window.open(viewUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Error generating preview");
    }
  };

  const handleSubmit = async (file) => {
    if (!id || !file) return;
    setIsSaving(true);
    try {
      const saveRes = await fetch(
        `${API_BASE}/vendor/openings/${id}/profiles/upload`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profiles: [file] }),
        }
      );
      const parsed = await parseResponse(saveRes);
      if (!parsed.ok) throw new Error(parsed.text || "Submit failed");

      // Update locally for draft submission
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, isDraft: false } : f))
      );

      // toast.success("Profile submitted successfully ✅");
    } catch (err) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!opening) return <div className="p-6">Opening not found</div>;

  return (
    <div className="p-6 bg-background text-foreground min-h-screen">
      <Toaster position="top-right" richColors />

      <button
        onClick={() => router.push("/vendor/openings")}
        className="flex items-center gap-2 text-muted-foreground mb-4"
      >
        <ArrowLeft size={18} /> Back to Openings
      </button>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{opening.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`px-2 py-1 text-xs rounded ${
                status === "PENDING"
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                  : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              }`}
            >
              {status}
            </span>
            <span>
              {opening.postedDate
                ? new Date(opening.postedDate).toLocaleDateString()
                : ""}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            hasUploadModalOpened.current = true;
            setIsUploadOpen(true);
          }}
          className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded"
        >
          <Upload size={16} /> Upload Candidate Profiles
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-6">
        <div className="col-span-2 space-y-4">
          <div className="border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Description</h2>
            <p className="text-muted-foreground">{opening.description}</p>
          </div>

          <div className="border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-2">
              Candidate Profiles Uploaded{" "}
              <span className="text-muted-foreground text-sm">
                {uploadedFiles.length}
              </span>
            </h2>

            <div className="space-y-2">
              {uploadedFiles.length > 0 ? (
                uploadedFiles.map((file) => (
                  <div
                    key={file.id || file.s3Key}
                    className="flex items-center justify-between bg-muted px-3 py-2 rounded dark:bg-gray-700"
                  >
                    <div className="flex flex-col gap-1 max-w-[70%]">
                      <span className="text-foreground break-all">
                        {file.filename}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded w-max ${
                          file.isDraft
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        }`}
                      >
                        {file.isDraft ? "Draft" : "Submitted"}
                      </span>
                    </div>

                    <div className="flex gap-3 items-center">
                      <Eye
                        size={18}
                        className={`cursor-pointer ${
                          file.s3Key ? "text-muted-foreground" : "text-gray-300"
                        }`}
                        onClick={() => handleView(file)}
                        title={file.s3Key ? "View" : "No preview available"}
                      />
                      <Trash2
                        size={18}
                        onClick={() => handleDelete(file)}
                        className="cursor-pointer text-red-600 dark:text-red-400"
                        title="Delete"
                      />
                      {file.isDraft && (
                        <Button
                          size="sm"
                          disabled={isSaving}
                          onClick={() => handleSubmit(file)}
                        >
                          {isSaving ? "Submitting..." : "Submit"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No profiles uploaded yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Job Details</h2>
            <p>
              <strong>Location:</strong> {opening.location}
            </p>
            <p>
              <strong>Contract Type:</strong> {opening.contractType}
            </p>
            <p>
              <strong>Experience:</strong> {opening.experienceMin} -{" "}
              {opening.experienceMax} years
            </p>
          </div>

          <div className="border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Hiring Manager</h2>
            <p>{opening.hiringManager?.name}</p>
            <p className="text-sm text-muted-foreground">
              {opening.hiringManager?.email}
            </p>
          </div>
        </div>
      </div>

      {isUploadOpen && (
        <UploadModal
          openingId={id}
          onClose={() => setIsUploadOpen(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
