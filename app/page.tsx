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
  Users,
  User,
  ShieldAlert,
  Award,
  TrendingUp,
  DollarSign,
  Calendar,
  ArrowRight,
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

type Customer = {
  id: string;
  business_id?: string;
  name: string;
  whatsapp_phone: string;
  total_orders: number;
  total_spend: number;
  first_order_at?: string;
  last_order_at?: string;
  is_flagged_risk?: boolean;
  customer_profiles?: any;
};

type CustomerDetail = {
  customer: Customer;
  profile: any;
  favourite_product?: { product_name: string; avg_qty: number; frequency: number };
  risk_score: number;
  recent_orders: any[];
  recent_flags: any[];
};

const COLORS = ['#4ca28d', '#e05b45', '#d49a4f', '#6c8fb7', '#8a65b7', '#b59e5f', '#4ea277', '#c15e8b', '#489f9e', '#5e7c8a'];

export default function SentrixDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [flags, setFlags] = useState<AnomalyFlag[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Analytics & Customer State
  const [activeTab, setActiveTab] = useState<"ledger" | "customers" | "analytics">("ledger");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  
  // Customer Intelligence State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingCustomerDetail, setLoadingCustomerDetail] = useState(false);
  
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

  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customers`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  const fetchCustomerDetail = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingCustomerDetail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${id}/profile`);
      if (res.ok) {
        const data = await res.json();
        setCustomerDetail(data);
      }
    } catch (err) {
      console.error("Error fetching customer profile:", err);
    } finally {
      setLoadingCustomerDetail(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchOrders();
    fetchFlags();
    fetchAnalytics();
    fetchCustomers();
  }, [fetchOrders, fetchFlags, fetchAnalytics, fetchCustomers]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetail(selectedCustomerId);
    } else if (customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [selectedCustomerId, customers, fetchCustomerDetail]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders();
      fetchFlags();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchFlags]);

  const handleDecision = async (targetId: string, decision: "approved" | "rejected" | "modified", isOrderId: boolean = false) => {
    setDecisionLoading(true);
    setErrorMessage("");
    try {
      const payload: any = {
        decision,
        notes: decisionNotes || `Processed via Sentrix Editorial Review Workspace.`
      };

      const endpoint = isOrderId 
        ? `${API_BASE_URL}/orders/${targetId}/decision`
        : `${API_BASE_URL}/flags/${targetId}/decision`;

      const res = await fetch(endpoint, {
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
          className={`pill ${activeTab === "customers" ? "active" : ""}`} 
          onClick={() => setActiveTab("customers")}
        >
          <Users size={14} style={{ marginRight: 6 }}/> Customer Profiles
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
      ) : activeTab === "customers" ? (
        <div className="main-content">
          {/* Left Pane: Customer Feed */}
          <div className="sidebar" style={{ width: 340 }}>
            <div className="list-header">
              <h2>Customer Directory</h2>
              <button onClick={fetchCustomers} disabled={loadingCustomers} style={{ color: "var(--color-text-muted)" }}>
                <RefreshCw size={14} className={loadingCustomers ? "animate-spin" : ""} />
              </button>
            </div>

            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <input 
                  type="text" 
                  placeholder="Search customer name or phone..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: "100%", backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: 6, padding: "8px 12px 8px 36px", color: "var(--color-text-primary)", fontSize: 13, outline: "none" }}
                />
              </div>
            </div>

            <div className="content-area">
              {customers
                .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.whatsapp_phone.includes(searchQuery))
                .map(cust => (
                  <div 
                    key={cust.id} 
                    className={`card ${selectedCustomerId === cust.id ? "selected" : ""}`}
                    onClick={() => setSelectedCustomerId(cust.id)}
                  >
                    <div className="card-header">
                      <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <User size={14} /> {cust.name}
                      </div>
                      <div className="card-amount">₹{(cust.total_spend || 0).toLocaleString()}</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <div className="card-subtitle" style={{ marginTop: 0 }}>
                        {cust.whatsapp_phone} • {cust.total_orders} Orders
                      </div>
                      {cust.is_flagged_risk ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-status-red)", backgroundColor: "var(--color-status-red-dim)", padding: "2px 6px", borderRadius: 4 }}>
                          ⚠️ High Risk
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-status-green)", backgroundColor: "var(--color-status-green-dim)", padding: "2px 6px", borderRadius: 4 }}>
                          ✓ Normal
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Right Pane: Detailed Customer Intelligence Profile */}
          <div className="content-area" style={{ borderLeft: "1px solid var(--color-border-subtle)", padding: "24px 32px", overflowY: "auto" }}>
            {loadingCustomerDetail ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted)" }}>
                <RefreshCw size={24} className="animate-spin" style={{ marginRight: 12 }} /> Building Customer Intelligence...
              </div>
            ) : customerDetail ? (
              <div>
                {/* Header Banner */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: 24, marginBottom: 24 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <h1 style={{ fontSize: 22, fontWeight: 700 }}>{customerDetail.customer.name}</h1>
                      <span className="mono" style={{ backgroundColor: "var(--color-bg-elevated)", padding: "4px 10px", borderRadius: 20, fontSize: 12, color: "var(--color-text-muted)" }}>
                        {customerDetail.customer.whatsapp_phone}
                      </span>
                    </div>
                    <div style={{ color: "var(--color-text-muted)", marginTop: 8, fontSize: 13, display: "flex", gap: 20 }}>
                      <span>First Order: <strong style={{ color: "var(--color-text-primary)" }}>{customerDetail.customer.first_order_at ? new Date(customerDetail.customer.first_order_at).toLocaleDateString() : "N/A"}</strong></span>
                      <span>Total Lifetime Orders: <strong style={{ color: "var(--color-text-primary)" }}>{customerDetail.customer.total_orders}</strong></span>
                      <span>Typical Order Window: <strong style={{ color: "var(--color-text-primary)" }}>{customerDetail.profile.typical_order_hour_start ?? 9}:00 – {customerDetail.profile.typical_order_hour_end ?? 18}:00 UTC</strong></span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Lifetime Spend</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: "var(--color-status-green)", marginTop: 2 }}>
                      ₹{(customerDetail.customer.total_spend || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Intelligence 4-Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
                  {/* Card 1: Favourite Product */}
                  <div style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-accent-blue)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
                      <Award size={16} /> Favourite Product
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, color: "var(--color-text-primary)" }}>
                      {customerDetail.favourite_product?.product_name || "N/A"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                      Avg {customerDetail.favourite_product?.avg_qty || 0} qty • Ordered {customerDetail.favourite_product?.frequency || 0} times
                    </div>
                  </div>

                  {/* Card 2: Normal Order Size */}
                  <div style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-status-green)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
                      <DollarSign size={16} /> Normal Order Size
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, color: "var(--color-text-primary)" }}>
                      ₹{(customerDetail.profile.avg_order_value || 0).toLocaleString()} / order
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                      Std Dev ±₹{(customerDetail.profile.stddev_order_value || 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Card 3: Buying Habits & Frequency */}
                  <div style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-status-amber)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
                      <Clock size={16} /> Buying Habits
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, color: "var(--color-text-primary)" }}>
                      Every ~{customerDetail.profile.avg_order_frequency_days || 1} Days
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                      Std Dev ±{customerDetail.profile.stddev_order_frequency_days || 0} days gap
                    </div>
                  </div>

                  {/* Card 4: Risk Score */}
                  <div style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: customerDetail.risk_score > 50 ? "var(--color-status-red)" : "var(--color-status-green)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
                      <ShieldAlert size={16} /> Behavioral Risk Score
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, color: customerDetail.risk_score > 50 ? "var(--color-status-red)" : "var(--color-status-green)" }}>
                      {customerDetail.risk_score} / 100
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                      {customerDetail.risk_score > 50 ? "High Risk • Spikes Triggered" : "Low Risk • Consistent Pattern"}
                    </div>
                  </div>
                </div>

                {/* Split Two Columns: Frequently Ordered Table + Anomaly Flag History */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  {/* Left Column: Frequently Ordered Items */}
                  <div style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <TrendingUp size={16} color="var(--color-accent-blue)" /> Learned Item Preferences & Frequency
                    </h3>
                    <div style={{ overflowX: "auto" }}>
                      <table className="table" style={{ width: "100%", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)", textAlign: "left" }}>
                            <th style={{ paddingBottom: 8 }}>Product Name</th>
                            <th style={{ paddingBottom: 8, textAlign: "right" }}>Avg Qty / Order</th>
                            <th style={{ paddingBottom: 8, textAlign: "right" }}>Orders Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(customerDetail.profile.common_items || []).map((item: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                              <td style={{ padding: "10px 0", fontWeight: 500 }}>
                                {item.product_name}
                                {idx === 0 && (
                                  <span style={{ marginLeft: 8, fontSize: 10, backgroundColor: "var(--color-accent-blue)", color: "white", padding: "2px 6px", borderRadius: 10 }}>
                                    #1 Favourite
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "10px 0", textAlign: "right", color: "var(--color-text-muted)" }}>{item.avg_qty}</td>
                              <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600 }}>{item.frequency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Triggered Anomaly Flags & Spikes */}
                  <div style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertTriangle size={16} color="var(--color-status-amber)" /> Anomaly & Spike Detection History
                    </h3>
                    {(customerDetail.recent_flags || []).length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {customerDetail.recent_flags.map((flag: any) => (
                          <div key={flag.id} style={{ backgroundColor: "var(--color-bg-base)", borderLeft: `3px solid ${flag.severity === "critical" || flag.severity === "high" ? "var(--color-status-red)" : "var(--color-status-amber)"}`, padding: 12, borderRadius: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: flag.severity === "critical" || flag.severity === "high" ? "var(--color-status-red)" : "var(--color-status-amber)" }}>
                                {flag.severity} Severity Anomaly
                              </span>
                              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                                {new Date(flag.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.4 }}>
                              {flag.llm_reasoning}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                        No historical anomalies recorded. This customer orders within expected thresholds (e.g. ~₹500/order).
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 48, color: "var(--color-text-muted)" }}>
                Select a customer from the left directory to view their AI-computed intelligence profile.
              </div>
            )}
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

          <div style={{ padding: "0 16px 12px 16px" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input 
                type="text" 
                placeholder="Search user name..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: "100%", backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: 6, padding: "8px 12px 8px 36px", color: "var(--color-text-primary)", fontSize: 13, outline: "none" }}
              />
            </div>
          </div>
          
          <div className="content-area">
            {(() => {
              const filteredOrders = orders
                .filter(o => statusFilter === "all" || o.status === statusFilter)
                .filter(o => !searchQuery || (o.customers?.name || "Unknown Customer").toLowerCase().includes(searchQuery.toLowerCase()));

              if (filteredOrders.length === 0 && !loadingOrders) {
                return (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-muted)" }}>
                    No orders found.
                  </div>
                );
              }

              const grouped: Record<string, Order[]> = {};
              const orderedNames: string[] = [];
              filteredOrders.forEach(o => {
                const name = o.customers?.name || "Unknown Customer";
                if (!grouped[name]) {
                  grouped[name] = [];
                  orderedNames.push(name);
                }
                grouped[name].push(o);
              });

              return orderedNames.map(name => {
                const custOrders = grouped[name];
                const totalCustAmount = custOrders.reduce((sum, o) => sum + (o.total_value || 0), 0);

                return (
                  <div key={name} className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16, border: "1px solid var(--color-border-subtle)" }}>
                    {/* Person Box Header */}
                    <div 
                      style={{ 
                        padding: "12px 16px", 
                        backgroundColor: "var(--color-bg-elevated)", 
                        borderBottom: "1px solid var(--color-border-subtle)",
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center" 
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <User size={15} color="var(--color-accent-blue)" />
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>{name}</span>
                        <span style={{ fontSize: 11, backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", padding: "2px 8px", borderRadius: 12, color: "var(--color-text-muted)" }}>
                          {custOrders.length} {custOrders.length === 1 ? "Message" : "Messages"}
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-status-green)" }}>
                        ₹{totalCustAmount.toLocaleString()}
                      </div>
                    </div>

                    {/* Messages inside this person's box */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {custOrders.map((order, i) => {
                        const hasFlag = flags.some(f => f.order_id === order.id && order.status === "pending_review");
                        const isSelected = selectedOrderId === order.id;
                        const msgText = order.whatsapp_messages?.raw_text || order.raw_parsed?.raw_text || (order.order_items?.map(it => `${it.quantity} ${it.unit} ${it.product_name_raw}`).join(", ")) || `Order #${order.id.split("-")[0]}`;

                        return (
                          <div 
                            key={order.id}
                            onClick={() => setSelectedOrderId(order.id)}
                            style={{ 
                              padding: "12px 16px", 
                              cursor: "pointer",
                              backgroundColor: isSelected ? "var(--color-bg-surface)" : "transparent",
                              borderBottom: i < custOrders.length - 1 ? "1px solid var(--color-border-subtle)" : "none",
                              transition: "background-color 0.2s"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? "var(--color-text-primary)" : "#d3dcd7", lineHeight: 1.3, flex: 1 }}>
                                💬 "{msgText}"
                              </div>
                              <div className="card-amount" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                                ₹{(order.total_value || 0).toLocaleString()}
                              </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div className="card-subtitle" style={{ marginTop: 0, fontSize: 11 }}>
                                Via {order.channel || "whatsapp"} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div className={`status ${order.status}`} style={{ fontSize: 10, padding: "2px 8px" }}>
                                {order.status.replace("_", " ").toUpperCase()}
                              </div>
                            </div>

                            {hasFlag && (
                              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, color: "var(--color-status-amber)", fontSize: 11, fontWeight: 600 }}>
                                <AlertTriangle size={12} /> ANOMALY DETECTED
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
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
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setActiveTab("customers");
                      if (selectedOrder.customers) {
                        const target = customers.find(c => c.name === selectedOrder.customers?.name || c.id === selectedOrder.customer_id);
                        if (target) setSelectedCustomerId(target.id);
                        else setSelectedCustomerId("cust-101");
                      } else {
                        setSelectedCustomerId("cust-101");
                      }
                    }}
                    style={{ marginTop: 12, padding: "4px 10px", fontSize: 12 }}
                  >
                    <User size={14} style={{ marginRight: 6 }} /> Inspect Customer Intelligence Profile ({selectedOrder.customers?.name}) →
                  </button>
                </div>
                <div className="card-amount" style={{ fontSize: 24 }}>
                  ₹{(selectedOrder.total_value || 0).toLocaleString()}
                </div>
              </div>

              <div className="detail-body">
                {/* Active Anomaly Flag or Human-in-the-Loop Approval Required */}
                {(selectedOrder.status === "pending_review" || selectedFlag) && (
                  <div className="anomaly-banner" style={{ backgroundColor: selectedFlag ? "rgba(224, 91, 69, 0.12)" : "rgba(74, 158, 255, 0.12)", border: `1px solid ${selectedFlag ? "var(--color-status-amber)" : "#4a9eff"}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      {selectedFlag ? (
                        <AlertTriangle size={18} color="var(--color-status-amber)" />
                      ) : (
                        <CheckCircle2 size={18} color="#4a9eff" />
                      )}
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
                        {selectedFlag ? "AI Anomaly Detected • Human-In-The-Loop Audit Required" : "Human-In-The-Loop Verification & Approval Required"}
                      </h4>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px 0", lineHeight: 1.4 }}>
                      {selectedFlag 
                        ? selectedFlag.llm_reasoning 
                        : "This order is currently pending human review. As an administrator, verify the raw message and parsed items below before accepting or rejecting this order."
                      }
                    </p>
                    
                    <div className="action-bar" style={{ backgroundColor: "rgba(0,0,0,0.3)", border: "1px solid var(--color-border-subtle)", borderRadius: 6, padding: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Add review notes or justification (optional)..." 
                        value={decisionNotes}
                        onChange={(e) => setDecisionNotes(e.target.value)}
                        style={{ flex: 1, minWidth: 220, backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border-subtle)", borderRadius: 4, padding: "8px 12px", color: "var(--color-text-primary)", fontSize: 13 }}
                      />
                      <div className="action-buttons" style={{ display: "flex", gap: 10 }}>
                        <button 
                          className="btn btn-success" 
                          disabled={decisionLoading}
                          onClick={() => handleDecision(selectedFlag ? selectedFlag.id : selectedOrder.id, "approved", !selectedFlag)}
                          style={{ backgroundColor: "var(--color-status-green)", color: "#000", fontWeight: 700, border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <CheckCircle2 size={16} /> Accept Order
                        </button>
                        <button 
                          className="btn btn-danger" 
                          disabled={decisionLoading}
                          onClick={() => handleDecision(selectedFlag ? selectedFlag.id : selectedOrder.id, "rejected", !selectedFlag)}
                          style={{ backgroundColor: "var(--color-status-red)", color: "#fff", fontWeight: 700, border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <XCircle size={16} /> Reject Order
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Override Bar when order is already Approved or Rejected */}
                {!(selectedOrder.status === "pending_review" || selectedFlag) && (
                  <div style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: "12px 16px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>Status: <strong className={`status ${selectedOrder.status}`}>{selectedOrder.status.replace("_", " ").toUpperCase()}</strong></span>
                      <span>• Admin Override Action:</span>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button 
                        className="btn btn-success" 
                        disabled={decisionLoading || selectedOrder.status === "approved"}
                        onClick={() => handleDecision(selectedOrder.id, "approved", true)}
                        style={{ backgroundColor: selectedOrder.status === "approved" ? "var(--color-bg-elevated)" : "var(--color-status-green)", color: selectedOrder.status === "approved" ? "var(--color-text-muted)" : "#000", fontWeight: 600, border: "none", padding: "6px 12px", borderRadius: 4, cursor: selectedOrder.status === "approved" ? "not-allowed" : "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <CheckCircle2 size={14} /> Mark Approved
                      </button>
                      <button 
                        className="btn btn-danger" 
                        disabled={decisionLoading || selectedOrder.status === "rejected"}
                        onClick={() => handleDecision(selectedOrder.id, "rejected", true)}
                        style={{ backgroundColor: selectedOrder.status === "rejected" ? "var(--color-bg-elevated)" : "var(--color-status-red)", color: selectedOrder.status === "rejected" ? "var(--color-text-muted)" : "#fff", fontWeight: 600, border: "none", padding: "6px 12px", borderRadius: 4, cursor: selectedOrder.status === "rejected" ? "not-allowed" : "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <XCircle size={14} /> Mark Rejected
                      </button>
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
