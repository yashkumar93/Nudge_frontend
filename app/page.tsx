"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  FileText,
  BarChart2
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Order = {
  id: string;
  business_id: string;
  channel?: string;
  total_value: number;
  status: string;
  created_at: string;
  customers?: { name: string; whatsapp_phone: string; total_orders: number; total_spend: number };
  order_items?: OrderItem[];
  whatsapp_messages?: { raw_text: string };
  raw_parsed?: any;
};

type OrderItem = {
  id: string;
  product_name_raw: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

type AnomalyFlag = {
  id: string;
  order_id: string;
  business_id: string;
  is_flagged: boolean;
  severity: "low" | "medium" | "high" | "critical";
  anomaly_type: string[];
  llm_reasoning: string;
  recommended_action: string;
  created_at: string;
  orders?: Order;
};

export default function NudgeDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [flags, setFlags] = useState<AnomalyFlag[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Analytics State
  const [activeTab, setActiveTab] = useState<"ledger" | "analytics">("ledger");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  
  // Selection
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  // Decision State
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Reporting
  const [reportDownloading, setReportDownloading] = useState(false);
  const [startDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`${API_BASE_URL}/orders?limit=50${statusFilter !== "all" ? `&status_filter=${statusFilter}` : ""}`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Unable to reach backend. Start it inside `/backend` with `python run.py`.");
    } finally {
      setLoadingOrders(false);
    }
  }, [statusFilter]);

  const fetchFlags = useCallback(async () => {
    setLoadingFlags(true);
    try {
      const res = await fetch(`${API_BASE_URL}/flags?limit=50`);
      if (!res.ok) throw new Error("Failed to load anomaly flags");
      const data = await res.json();
      setFlags(data.flags || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFlags(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchOrders();
    fetchFlags();
    fetchAnalytics();
  }, [fetchOrders, fetchFlags, fetchAnalytics]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders();
      fetchFlags();
      // Optional: fetchAnalytics() too if you want live updates, but usually not needed as frequently
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchFlags]);

  const handleDecision = async (flagId: string, decision: "approved" | "rejected" | "modified") => {
    setDecisionLoading(true);
    setErrorMessage("");
    try {
      const payload: any = {
        decision,
        notes: decisionNotes || `Processed via Nudge Editorial Review Workspace.`
      };

      const res = await fetch(`${API_BASE_URL}/flags/${flagId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned ${res.status}`);
      }
      
      setDecisionNotes("");
      setSelectedOrderId(null);
      refreshAll(); // Ensure UI instantly updates after decision
    } catch (err: any) {
      console.error("Decision Error:", err);
      setErrorMessage(`Failed to record decision: ${err.message}`);
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    setReportDownloading(true);
    try {
      const url = `${API_BASE_URL}/reports/generate?start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to download PDF report");
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `nudge_report_${startDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Error generating report. Make sure FastAPI server is running.");
    } finally {
      setReportDownloading(false);
    }
  };

  // Find the selected order and its flag (if any)
  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const selectedFlag = selectedOrder ? flags.find(f => f.order_id === selectedOrder.id && f.orders?.status === "pending_review") : null;

  return (
    <div className="app-container">
      {errorMessage && (
        <div style={{ backgroundColor: "var(--color-status-red)", color: "white", padding: "8px 16px", fontSize: "12px", textAlign: "center" }}>
          {errorMessage}
          <button onClick={() => setErrorMessage("")} style={{ float: "right", color: "white" }}><XCircle size={14}/></button>
        </div>
      )}

      <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", gap: 12 }}>
        <button 
          className={`pill ${activeTab === "ledger" ? "active" : ""}`} 
          onClick={() => setActiveTab("ledger")}
        >
          <FileText size={14} style={{ marginRight: 6 }}/> Audit Ledger
        </button>
        <button 
          className={`pill ${activeTab === "analytics" ? "active" : ""}`} 
          onClick={() => setActiveTab("analytics")}
        >
          <BarChart2 size={14} style={{ marginRight: 6 }}/> Analytics
        </button>
      </div>
      
      {activeTab === "analytics" ? (
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Total Orders</div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>{analyticsData?.total_orders || 0}</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Total Revenue</div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>₹{(analyticsData?.total_revenue || 0).toLocaleString()}</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Approval Rate</div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>
                {analyticsData ? Math.round((analyticsData.decisions.approved / ((analyticsData.decisions.approved + analyticsData.decisions.rejected) || 1)) * 100) : 0}%
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ marginBottom: 20, fontSize: 14 }}>Order Volume Trend</h3>
              <div style={{ height: 300 }}>
                {analyticsData && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.volume_trend}>
                      <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "var(--color-bg-surface)" }} contentStyle={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)", borderRadius: 8 }} />
                      <Bar dataKey="orders" fill="var(--color-text-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ marginBottom: 20, fontSize: 14 }}>Anomaly Severity</h3>
              <div style={{ height: 260 }}>
                {analyticsData && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData.severities.filter((s: any) => s.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {analyticsData.severities.map((entry: any, index: number) => {
                          const colors: any = { Low: "#3f3f46", Medium: "#eab308", High: "#f97316", Critical: "#ef4444" };
                          return <Cell key={`cell-${index}`} fill={colors[entry.name] || "#ffffff"} />;
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                  {analyticsData?.severities.map((s: any) => (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-text-muted)" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: s.name === "Low" ? "#3f3f46" : s.name === "Medium" ? "#eab308" : s.name === "High" ? "#f97316" : "#ef4444" }}></div>
                      {s.name} ({s.value})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="main-content">
        {/* Left Pane: Orders Feed */}
        <div className="sidebar">
          <div className="list-header">
            <h2>Order Feed</h2>
            <button onClick={refreshAll} disabled={loadingOrders} style={{ color: "var(--color-text-muted)" }}>
              <RefreshCw size={14} className={loadingOrders ? "animate-spin" : ""} />
            </button>
          </div>
          
          <div className="filter-tabs">
            {["all", "pending", "approved", "rejected"].map(tab => (
              <div
                key={tab}
                className={`filter-tab ${statusFilter === tab ? "active" : ""}`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </div>
            ))}
          </div>
          
          <div className="content-area">
            {orders.length === 0 && !loadingOrders && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-muted)" }}>
                No orders found.
              </div>
            )}
            {orders.map((order, index) => {
              const hasFlag = flags.some(f => f.order_id === order.id && order.status === "pending_review");
              
              const prevOrder = index > 0 ? orders[index - 1] : null;
              const isSameCustomerAsPrev = prevOrder && prevOrder.customers?.name === order.customers?.name;
              
              return (
                <div 
                  key={order.id} 
                  className={`card ${selectedOrderId === order.id ? "selected" : ""}`}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <div className="card-header">
                    <div>
                      {!isSameCustomerAsPrev && (
                        <div className="card-title">{order.customers?.name || "Unknown Customer"}</div>
                      )}
                      <div className="card-subtitle" style={isSameCustomerAsPrev ? { marginTop: 0 } : {}}>
                        Via {order.channel} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="card-amount">₹{(order.total_value || 0).toLocaleString()}</div>
                      <div className={`status ${order.status}`}>{order.status.replace("_", " ")}</div>
                    </div>
                  </div>
                  {hasFlag && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, color: "var(--color-status-amber)", fontSize: 11, fontWeight: 600 }}>
                      <AlertTriangle size={12} /> ANOMALY DETECTED
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Details & Audit */}
        <div className="content-area" style={{ borderLeft: "1px solid var(--color-border-subtle)" }}>
          {selectedOrder ? (
            <div>
              <div className="detail-header">
                <div>
                  <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {selectedOrder.customers?.name || "Customer Details"}
                    <span className={`status ${selectedOrder.status}`}>{selectedOrder.status.replace("_", " ")}</span>
                  </h1>
                  <div style={{ color: "var(--color-text-muted)", marginTop: 4, display: "flex", gap: 16 }}>
                    <span>Order ID: <span className="mono">{selectedOrder.id.split("-")[0]}</span></span>
                    <span>Channel: {selectedOrder.channel}</span>
                    <span>{new Date(selectedOrder.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="card-amount" style={{ fontSize: 24 }}>
                  ₹{(selectedOrder.total_value || 0).toLocaleString()}
                </div>
              </div>

              <div className="detail-body">
                {/* Active Anomaly Flag */}
                {selectedFlag && (
                  <div className="anomaly-banner">
                    <h4><AlertTriangle size={16} /> Audit Required</h4>
                    <p>{selectedFlag.llm_reasoning}</p>
                    
                    <div className="action-bar" style={{ marginTop: 16, backgroundColor: "rgba(0,0,0,0.2)", border: "none" }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Add review notes (optional)..." 
                        value={decisionNotes}
                        onChange={(e) => setDecisionNotes(e.target.value)}
                        style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                      />
                      <div className="action-buttons">
                        <button 
                          className="btn btn-success" 
                          disabled={decisionLoading}
                          onClick={() => handleDecision(selectedFlag.id, "approved")}
                        >
                          <CheckCircle2 size={16} /> Force Approve
                        </button>
                        <button 
                          className="btn btn-danger" 
                          disabled={decisionLoading}
                          onClick={() => handleDecision(selectedFlag.id, "rejected")}
                        >
                          <XCircle size={16} /> Reject Order
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Raw Input vs Parsed */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div>
                    <div className="section-title">Raw Message</div>
                    <div style={{ padding: 16, backgroundColor: "var(--color-bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-subtle)", whiteSpace: "pre-wrap", fontSize: 13, color: "var(--color-text-muted)" }}>
                      {selectedOrder.whatsapp_messages?.raw_text || "No raw text available."}
                    </div>
                  </div>
                  <div>
                    <div className="section-title">Parsed Items</div>
                    <div style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                      <table className="data-table">
                        <thead style={{ backgroundColor: "var(--color-bg-surface)" }}>
                          <tr>
                            <th>Item</th>
                            <th style={{ textAlign: "right" }}>Qty</th>
                            <th style={{ textAlign: "right" }}>Price</th>
                            <th style={{ textAlign: "right" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedOrder.order_items || selectedOrder.raw_parsed?.items || []).map((item: any, i: number) => (
                            <tr key={i}>
                              <td>{item.product_name_raw}</td>
                              <td style={{ textAlign: "right" }}>{item.quantity} {item.unit}</td>
                              <td style={{ textAlign: "right" }}>₹{item.unit_price || 0}</td>
                              <td style={{ textAlign: "right", fontWeight: 500 }}>₹{item.line_total || (item.quantity * item.unit_price) || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted)" }}>
              <FileText size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <p>Select an order from the feed to view details and resolve anomalies.</p>
              
              <button className="btn btn-outline" style={{ marginTop: 24 }} onClick={handleDownloadReport} disabled={reportDownloading}>
                <Download size={14} /> {reportDownloading ? "Generating..." : "Download Daily Report"}
              </button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
