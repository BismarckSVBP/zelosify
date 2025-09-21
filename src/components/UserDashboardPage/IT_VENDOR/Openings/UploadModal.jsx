"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

async function parseResponse(res) {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return { ok: res.ok, status: res.status, data, text };
  } catch {
    return { ok: res.ok, status: res.status, data: null, text };
  }
}

export default function UploadModal({ openingId, onClose, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isUploadingFinal, setIsUploadingFinal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const handleRemove = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const uploadFiles = async (endpoint) => {
    if (!openingId || files.length === 0) return;

    if (endpoint === "uploadasdraft") {
      setIsSavingDraft(true);
    } else {
      setIsUploadingFinal(true);
    }

    try {
      const uploadedProfiles = [];

      // 1) Upload each file to presign endpoint
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file, file.name);
        formData.append("filename", file.name);

        const uploadRes = await fetch(
          `${API_BASE}/vendor/openings/${openingId}/profiles/presign`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );

        const uploadParsed = await parseResponse(uploadRes);
        if (!uploadParsed.ok)
          throw new Error(uploadParsed.text || "Presign failed");

        const { filename, s3Key } =
          uploadParsed.data?.data || uploadParsed.data || {};
        uploadedProfiles.push({ filename, s3Key });
      }

      // 2) Save uploaded profiles as draft or final
      const saveRes = await fetch(
        `${API_BASE}/vendor/openings/${openingId}/profiles/${endpoint}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profiles: uploadedProfiles }),
        }
      );

      const saveParsed = await parseResponse(saveRes);
      if (!saveParsed.ok)
        throw new Error(saveParsed.text || "Save profiles failed");

      // 3) Normalize server-returned profiles
      const raw = saveParsed.data?.data || saveParsed.data;
      const rawArr = Array.isArray(raw) ? raw : raw ? [raw] : [];

      const normalizedForParent = rawArr.map((p) => ({
        id: p.id,
        filename:
          p.fileName || p.filename || (p.s3Key ? p.s3Key.split("/").pop() : ""),
        s3Key: p.s3Key || null,
        isDraft: p.isDraft ?? false,
        __raw: p,
      }));

      // 4) Send normalized array to parent
      onUploaded(normalizedForParent);

      // 5) Reset and close
      setFiles([]);
      setTimeout(() => onClose(), 0);
    } catch (err) {
      alert(err.message || "Upload failed");
    } finally {
      setIsSavingDraft(false);
      setIsUploadingFinal(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background text-foreground rounded-2xl shadow-lg w-[520px] p-6 dark:bg-gray-800 dark:text-gray-100">
        <h2 className="text-lg font-semibold mb-4">
          Upload Candidate Profiles
        </h2>

        {/* Drag & Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
              : "border-border dark:border-gray-600"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="fileInput"
            accept=".pdf,.ppt,.pptx"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="fileInput" className="cursor-pointer">
            Drag & drop or click to browse <br />
            <span className="font-medium text-muted-foreground dark:text-gray-400">
              Supported: .pdf, .ppt, .pptx
            </span>
          </label>
        </div>

        {files.length > 0 && (
          <div className="max-h-40 overflow-y-auto mb-4">
            <h3 className="text-sm font-medium mb-2">
              Selected Files ({files.length})
            </h3>
            {files.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-muted px-3 py-2 rounded mb-1 dark:bg-gray-700"
              >
                <span className="truncate max-w-[70%]">{f.name}</span>
                <button
                  onClick={() => handleRemove(idx)}
                  className="text-red-500 px-2 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setFiles([]);
              onClose();
            }}
            disabled={isSavingDraft || isUploadingFinal}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            Cancel
          </button>

          <button
            onClick={() => uploadFiles("uploadasdraft")}
            disabled={isSavingDraft || isUploadingFinal || files.length === 0}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg disabled:opacity-60 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            {isSavingDraft ? "Saving..." : "Save as Draft"}
          </button>

          <button
            onClick={() => uploadFiles("upload")}
            disabled={isSavingDraft || isUploadingFinal || files.length === 0}
            className="px-4 py-2 bg-black text-white rounded-lg disabled:opacity-60 hover:bg-gray-900 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            {isUploadingFinal ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
