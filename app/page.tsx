"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  FileText,
  BarChart2,
  X
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

const COLORS = ['#4ca28d', '#e05b45', '#d49a4f', '#6c8fb7', '#8a65b7', '#b59e5f', '#4ea277', '#c15e8b', '#489f9e', '#5e7c8a'];

export default function SentrixDashboard() {
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

  // Order Modal
  const [isOrderModalOpen, setOrderModalOpen] = useState(false);

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
        notes: decisionNotes || `Processed via Sentrix Editorial Review Workspace.`
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
      a.download = `sentrix_report_${startDate}.pdf`;
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
  const selectedFlag = (selectedOrder && selectedOrder.status === "pending_review") ? flags.find(f => f.order_id === selectedOrder.id) : null;

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
        <Link 
          href="/reports"
          className="pill" 
          style={{ textDecoration: "none", display: "flex", alignItems: "center" }}
        >
          <Download size={14} style={{ marginRight: 6 }}/> Reports
        </Link>
        <div style={{ flex: 1 }}></div>
        <button 
          onClick={() => setOrderModalOpen(true)}
          style={{
            backgroundColor: "#c2593e",
            color: "white",
            border: "none",
            padding: "8px 16px",
            fontSize: "12px",
            fontWeight: "bold",
            letterSpacing: "1px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, width: 6, height: 6, borderTop: "2px solid white", borderLeft: "2px solid white" }}></div>
          <div style={{ position: "absolute", bottom: 0, left: 0, width: 6, height: 6, borderBottom: "2px solid white", borderLeft: "2px solid white" }}></div>
          <div style={{ position: "absolute", top: 0, right: 0, width: 6, height: 6, borderTop: "2px solid white", borderRight: "2px solid white" }}></div>
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 6, height: 6, borderBottom: "2px solid white", borderRight: "2px solid white" }}></div>
          <div style={{ width: 8, height: 8, backgroundColor: "#e2b8a7", borderRadius: "50%" }}></div>
          PLACE ORDER
        </button>
      </div>
      
      {activeTab === "analytics" ? (
        <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 24, backgroundColor: "#171a19" }}>
          
          <div style={{ backgroundColor: "#1e2421", borderRadius: 8, padding: "24px 32px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#8da598", marginBottom: 32, textTransform: "uppercase", letterSpacing: "1px" }}>Order Distribution</h3>
            
            <div style={{ display: "flex", gap: 64, alignItems: "center" }}>
              {/* Chart */}
              <div style={{ position: "relative", width: 240, height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData?.order_distribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="count"
                      stroke="none"
                    >
                      {(analyticsData?.order_distribution || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ backgroundColor: "#1e2421", border: "1px solid #2a342f", color: "#fff" }}
                        itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                  <div style={{ fontSize: 36, fontWeight: "bold", color: "#fff", lineHeight: 1 }}>
                    {analyticsData?.total_orders || 0}
                  </div>
                  <div style={{ fontSize: 10, color: "#8da598", textTransform: "uppercase", marginTop: 8, letterSpacing: "0.5px" }}>
                    Total Orders
                  </div>
                </div>
              </div>

              {/* Legend / List */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: -20 }}>
                {(analyticsData?.order_distribution || []).map((item: any, i: number) => (
                  <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < (analyticsData?.order_distribution.length - 1) ? "1px solid #2a342f" : "none" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: COLORS[i % COLORS.length] }} />
                        <span style={{ color: "#d3dcd7", fontSize: 14 }}>{item.name}</span>
                      </div>
                      <div style={{ color: "#7a8a83", fontSize: 12, marginLeft: 16, marginTop: 4 }}>
                        #{i + 1} &nbsp;&middot;&nbsp; {item.percentage}%
                      </div>
                    </div>
                    <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                      {item.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Metrics Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 24, backgroundColor: "#1c211f", borderTop: "1px solid #262f2b", borderRadius: 8, padding: "20px 32px", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#7a8a83", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Most Active Customer</div>
              <div style={{ fontSize: 18, color: "#fff", fontWeight: 600 }}>
                {analyticsData?.most_active_customer?.name || "-"} <span style={{ color: "#7a8a83", margin: "0 4px" }}>&middot;</span> {analyticsData?.most_active_customer?.count || 0}
              </div>
            </div>
            <div style={{ borderLeft: "1px solid #262f2b", paddingLeft: 32 }}>
              <div style={{ fontSize: 10, color: "#7a8a83", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Highest Deviation This Week</div>
              <div style={{ fontSize: 18, color: "#e05b45", fontWeight: 600 }}>
                {analyticsData?.highest_deviation || "-"}
              </div>
            </div>
            <div style={{ borderLeft: "1px solid #262f2b", paddingLeft: 32 }}>
              <div style={{ fontSize: 10, color: "#7a8a83", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Orders Today</div>
              <div style={{ fontSize: 18, color: "#fff", fontWeight: 600 }}>
                {analyticsData?.orders_today || 0}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setOrderModalOpen(true)}
                style={{ backgroundColor: "#e05b45", color: "#fff", border: "none", borderRadius: 4, padding: "12px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, letterSpacing: "1px" }}
              >
                <div style={{ width: 6, height: 6, backgroundColor: "#fff", borderRadius: "50%", opacity: 0.5 }} />
                PLACE ORDER
              </button>
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
            </div>
          )}
        </div>
      </div>
      )}

      {/* Place Order Modal */}
      {isOrderModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#1a231f", padding: "32px", borderRadius: "8px", width: "400px", position: "relative", border: "1px solid #2a332f", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
            <button 
              onClick={() => setOrderModalOpen(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={18} />
            </button>
            <h2 style={{ margin: "0 0 16px 0", color: "#f8e5d6", fontFamily: "serif", fontSize: "24px" }}>Order on WhatsApp</h2>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "16px", fontSize: "14px" }}>First time? Send this code to join:</p>
            
            <div style={{ backgroundColor: "#0f1512", padding: "16px", borderRadius: "4px", textAlign: "center", marginBottom: "24px", border: "1px solid #1a231f" }}>
              <code style={{ color: "#d97757", fontSize: "18px", letterSpacing: "1px", fontFamily: "monospace" }}>join main-wide</code>
            </div>
            
            <a 
              href="https://api.whatsapp.com/send/?phone=%2B14155238886&text=Hi%2C+I+want+to+place+an+order&type=phone_number&app_absent=0" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: "block",
                backgroundColor: "#c2593e",
                color: "white",
                textDecoration: "none",
                textAlign: "center",
                padding: "14px",
                borderRadius: "4px",
                fontWeight: "bold",
                letterSpacing: "1px",
                marginBottom: "16px",
                fontSize: "14px"
              }}
            >
              PLACE AN ORDER INSTEAD
            </a>
            
            <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px", margin: 0 }}>Need to rejoin?</p>
          </div>
        </div>
      )}
    </div>
  );
}
