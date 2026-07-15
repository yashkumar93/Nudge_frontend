"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Filter } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let url = `${API_BASE_URL}/reports/generate?start_date=${startDate}&end_date=${endDate}`;
      if (status !== "all") url += `&status=${status}`;
      if (severity !== "all") url += `&severity=${severity}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to download report");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `nudge_report_${startDate}_to_${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Error generating report. Make sure backend is running.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="app-container">
      <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/" style={{ color: "var(--color-text-muted)", display: "flex", alignItems: "center" }}>
          <ArrowLeft size={16} />
        </Link>
        <h1 style={{ fontSize: "16px", margin: 0 }}>Custom Report Builder</h1>
      </div>

      <div style={{ padding: "32px", maxWidth: "600px", margin: "0 auto", width: "100%" }}>
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, color: "var(--color-text-primary)" }}>
            <Filter size={18} />
            <h2 style={{ margin: 0 }}>Report Parameters</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, color: "var(--color-text-muted)", fontSize: 12 }}>Start Date</label>
              <input 
                type="date" 
                className="input-field" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: "100%", backgroundColor: "var(--color-bg-base)" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, color: "var(--color-text-muted)", fontSize: 12 }}>End Date</label>
              <input 
                type="date" 
                className="input-field" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%", backgroundColor: "var(--color-bg-base)" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: 8, color: "var(--color-text-muted)", fontSize: 12 }}>Order Status</label>
            <select 
              className="input-field" 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              style={{ width: "100%", backgroundColor: "var(--color-bg-base)", appearance: "none" }}
            >
              <option value="all">All Statuses</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="auto_approved">Auto Approved</option>
              <option value="rejected">Rejected</option>
              <option value="modified">Modified</option>
            </select>
          </div>

          <div style={{ marginBottom: "32px" }}>
            <label style={{ display: "block", marginBottom: 8, color: "var(--color-text-muted)", fontSize: 12 }}>Anomaly Severity</label>
            <select 
              className="input-field" 
              value={severity} 
              onChange={(e) => setSeverity(e.target.value)}
              style={{ width: "100%", backgroundColor: "var(--color-bg-base)", appearance: "none" }}
            >
              <option value="all">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleDownload} 
            disabled={downloading}
            style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "14px", display: "flex", gap: "8px", alignItems: "center" }}
          >
            <Download size={16} /> {downloading ? "Generating PDF..." : "Generate & Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
