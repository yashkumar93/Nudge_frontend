"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Send,
  MessageSquare,
  Package,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  TrendingUp,
  X,
  Search,
  ChevronRight,
  Filter,
  Sparkles,
  PhoneCall,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Sliders,
  Settings,
  Calendar,
  Download,
  AlertTriangle
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface OrderItem {
  id?: string;
  product_name_raw: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  line_total?: number;
}

interface Customer {
  name: string;
  whatsapp_phone: string;
  total_orders?: number;
  total_spend?: number;
}

interface Order {
  id: string;
  business_id: string;
  customer_id: string;
  order_time: string;
  total_value?: number;
  status: string;
  raw_parsed?: {
    items: OrderItem[];
    total_estimate?: number;
    notes?: string;
  };
  created_at: string;
  customers?: Customer;
  order_items?: OrderItem[];
  whatsapp_messages?: {
    raw_text: string;
  };
}

interface AnomalyFlag {
  id: string;
  order_id: string;
  business_id: string;
  is_flagged: boolean;
  severity: "low" | "medium" | "high" | "critical";
  anomaly_type: string[];
  llm_reasoning: string;
  recommended_action: "approve" | "hold_for_review" | "contact_customer" | "check_inventory" | "escalate" | "reject";
  confidence_score: number;
  raw_signals: any;
  model_used: string;
  created_at: string;
  orders?: Order;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "flags" | "analytics">("orders");
  
  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");
  
  // Flags State
  const [flags, setFlags] = useState<AnomalyFlag[]>([]);
  const [loadingFlags, setLoadingFlags] = useState<boolean>(true);
  const [flagSearchQuery, setFlagSearchQuery] = useState<string>("");
  const [flagStatusFilter, setFlagStatusFilter] = useState<"pending" | "resolved" | "all">("pending");
  
  // Common states
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Decision Modal State
  const [decisionFlag, setDecisionFlag] = useState<AnomalyFlag | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string>("");
  const [decisionLoading, setDecisionLoading] = useState<boolean>(false);
  
  // Modify State
  const [isModifying, setIsModifying] = useState<boolean>(false);
  const [modItems, setModItems] = useState<OrderItem[]>([]);
  const [modTotal, setModTotal] = useState<number>(0);

  // Reports Date range
  const [startDate, setStartDate] = useState<string>("2026-07-01");
  const [endDate, setEndDate] = useState<string>("2026-07-15");
  const [reportDownloading, setReportDownloading] = useState<boolean>(false);

  const fetchOrders = useCallback(async (isQuiet = false) => {
    if (!isQuiet) setLoadingOrders(true);
    else setRefreshing(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/orders?limit=50${statusFilter !== "all" ? `&status_filter=${statusFilter}` : ""}`);
      if (!res.ok) throw new Error("Failed to connect to backend API");
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error("Error loading orders:", err);
      setError("Unable to reach backend. If testing locally without the Python server running, start it with `python run.py` inside `/backend`.");
    } finally {
      setLoadingOrders(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  const fetchFlags = useCallback(async (isQuiet = false) => {
    if (!isQuiet) setLoadingFlags(true);
    else setRefreshing(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/flags?limit=50`);
      if (!res.ok) throw new Error("Failed to load anomaly flags");
      const data = await res.json();
      setFlags(data.flags || []);
    } catch (err) {
      console.error("Error loading flags:", err);
    } finally {
      setLoadingFlags(false);
      setRefreshing(false);
    }
  }, []);

  const refreshAll = useCallback((isQuiet = false) => {
    fetchOrders(isQuiet);
    fetchFlags(isQuiet);
  }, [fetchOrders, fetchFlags]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto polling every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshAll(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  const handleDecision = async (flagId: string, decision: "approved" | "rejected" | "modified", overrideData?: any) => {
    setDecisionLoading(true);
    try {
      const payload: any = {
        decision,
        notes: decisionNotes || `Processed via Nudge Review Dashboard.`
      };
      
      if (decision === "modified" && overrideData) {
        payload.modified_order_data = overrideData;
      }

      const res = await fetch(`${API_BASE_URL}/flags/${flagId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to record decision");
      
      // Close modal / state
      setDecisionFlag(null);
      setDecisionNotes("");
      setIsModifying(false);
      
      // Force instant refresh of both feeds
      await refreshAll(true);
    } catch (err) {
      console.error("Error recording decision:", err);
      alert("Failed to submit decision to server.");
    } finally {
      setDecisionLoading(false);
    }
  };

  const startModify = (flag: AnomalyFlag) => {
    const orderItems = flag.orders?.order_items || flag.orders?.raw_parsed?.items || [];
    setModItems([...orderItems]);
    setModTotal(flag.orders?.total_value || 0);
    setDecisionFlag(flag);
    setIsModifying(true);
  };

  const updateModQty = (index: number, qty: number) => {
    const updated = [...modItems];
    updated[index].quantity = qty;
    
    // Recalculate total if unit price exists
    if (updated[index].unit_price) {
      updated[index].line_total = qty * (updated[index].unit_price || 0);
    }
    
    // Recalculate global total
    const total = updated.reduce((acc, item) => {
      return acc + (item.line_total || (item.quantity * (item.unit_price || 0)) || 0);
    }, 0);
    
    setModItems(updated);
    setModTotal(total);
  };

  const handleDownloadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportDownloading(true);
    try {
      const url = `${API_BASE_URL}/reports/generate?start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to download PDF report");
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `nudge_report_${startDate}_to_${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Error downloading report:", err);
      alert("Error generating report. Make sure FastAPI server is running.");
    } finally {
      setReportDownloading(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter(order => {
    if (orderSearchQuery.trim() === "") return true;
    const q = orderSearchQuery.toLowerCase();
    const custName = order.customers?.name?.toLowerCase() || "";
    const custPhone = order.customers?.whatsapp_phone || "";
    const rawMsg = order.whatsapp_messages?.raw_text?.toLowerCase() || "";
    return custName.includes(q) || custPhone.includes(q) || rawMsg.includes(q);
  });

  // Filtered flags
  const filteredFlags = flags.filter(flag => {
    const order = flag.orders;
    if (!order) return false;
    
    // 1. Filter by flag status tab
    if (flagStatusFilter === "pending" && order.status !== "pending_review") {
      return false;
    }
    if (flagStatusFilter === "resolved" && order.status === "pending_review") {
      return false;
    }
    
    // 2. Search query check
    if (flagSearchQuery.trim() === "") return true;
    const q = flagSearchQuery.toLowerCase();
    const custName = order.customers?.name?.toLowerCase() || "";
    const reasoning = flag.llm_reasoning.toLowerCase();
    return custName.includes(q) || reasoning.includes(q);
  });

  // Calculate Metrics
  const totalSpend = orders.reduce((acc, curr) => acc + (curr.total_value || 0), 0);
  const totalFlagsCount = flags.filter(f => f.is_flagged && f.orders?.status === "pending_review").length;
  
  // Extract inventory shortfalls from flags signals
  const inventoryAlerts: any[] = [];
  flags.forEach(f => {
    const risks = f.raw_signals?.inventory?.inventory_risks || [];
    risks.forEach((r: any) => {
      inventoryAlerts.push({
        ...r,
        customer: f.orders?.customers?.name || "Client",
        orderId: f.orders?.id,
        date: f.created_at
      });
    });
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">Critical</span>;
      case "high":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">High</span>;
      case "medium":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">Medium</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "auto_approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case "pending_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case "modified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Edit3 className="w-3.5 h-3.5" /> Modified
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. TOP METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Inbound Orders</p>
            <h3 className="text-3xl font-bold text-white mt-1">{orders.length}</h3>
            <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected to Webhooks
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending Audit Review</p>
            <h3 className="text-3xl font-bold text-white mt-1">{totalFlagsCount}</h3>
            <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 animate-pulse" /> Action required
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Value Flow</p>
            <h3 className="text-3xl font-bold text-white mt-1">₹{totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-slate-400 mt-1.5">Across all order status groups</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Agent Pipeline Status</p>
            <h3 className="text-3xl font-bold text-white mt-1">Active</h3>
            <p className="text-xs text-emerald-400 mt-1.5">LangGraph State Orchestrator</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. TABS SELECTOR */}
      <div className="border-b border-white/10 flex items-center justify-between pb-1">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("orders")}
            className={`pb-3 text-sm font-semibold tracking-wide transition-all border-b-2 cursor-pointer ${
              activeTab === "orders"
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Order Feed
          </button>
          <button
            onClick={() => setActiveTab("flags")}
            className={`pb-3 text-sm font-semibold tracking-wide transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "flags"
                ? "border-rose-500 text-white"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Anomaly Audit Panel
            {totalFlagsCount > 0 && (
              <span className="bg-rose-500 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {totalFlagsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`pb-3 text-sm font-semibold tracking-wide transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "analytics"
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Analytics & PDF Reports
          </button>
        </div>
        
        <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            id="autoRefresh"
            className="rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer"
          />
          <label htmlFor="autoRefresh" className="cursor-pointer">Auto-refresh (5s)</label>
          <button
            onClick={() => refreshAll(true)}
            className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 cursor-pointer ml-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Connection Alert</p>
            <p className="mt-0.5 text-rose-200/90">{error}</p>
          </div>
        </div>
      )}

      {/* 4. ACTIVE TAB PANELS */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              All Orders Raw/Parsed Feed
            </h2>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer, text..."
                  value={orderSearchQuery}
                  onChange={e => setOrderSearchQuery(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/20 w-48 sm:w-64"
                />
              </div>

              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10 text-xs">
                {["all", "pending_review", "approved", "rejected", "modified"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                      statusFilter === tab
                        ? "bg-emerald-500 text-white font-medium shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingOrders ? (
            <div className="glass-panel rounded-2xl p-16 text-center border border-white/10">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-white">Loading orders feed...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-panel rounded-2xl p-16 text-center border border-white/10">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-xs text-slate-400">No matching orders found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((order) => {
                const items = order.order_items || order.raw_parsed?.items || [];
                const custName = order.customers?.name || "Customer";
                const rawText = order.whatsapp_messages?.raw_text || order.raw_parsed?.notes || "Raw WhatsApp text unavailable";

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="glass-panel glass-panel-hover rounded-2xl p-5 border border-white/10 cursor-pointer transition-all group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-2 max-w-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-slate-300 font-semibold text-sm shrink-0">
                            <User className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                                {custName}
                              </h4>
                              <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                +{order.customers?.whatsapp_phone}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Spend history: ₹{order.customers?.total_spend || 0} ({order.customers?.total_orders || 0} orders)
                            </p>
                          </div>
                        </div>

                        <div className="bg-black/40 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 font-sans italic flex items-start gap-2.5">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <p className="line-clamp-2 leading-relaxed">&ldquo;{rawText}&rdquo;</p>
                        </div>
                      </div>

                      <div className="flex-1 lg:px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {items.slice(0, 4).map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 font-medium"
                            >
                              <span className="font-bold text-emerald-400">{item.quantity} {item.unit || "unit"}</span>
                              <span className="text-slate-300">{item.product_name_raw}</span>
                            </span>
                          ))}
                          {items.length > 4 && (
                            <span className="inline-flex items-center text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 font-mono">
                              +{items.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-white/5">
                        <div className="text-left lg:text-right">
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Total Value</p>
                          <p className="text-lg font-bold text-white mt-0.5">
                            ₹{(order.total_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {getStatusBadge(order.status)}
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "flags" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Anomaly Audit Reviews
              </h2>
              <p className="text-xs text-slate-400">
                Orders audited by the LangGraph agent. Use actions to resolve outstanding flags.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search flagged reviews..."
                  value={flagSearchQuery}
                  onChange={e => setFlagSearchQuery(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/20 w-48 sm:w-64"
                />
              </div>

              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10 text-xs">
                {(["pending", "resolved", "all"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFlagStatusFilter(tab)}
                    className={`px-3 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                      flagStatusFilter === tab
                        ? "bg-rose-500 text-white font-medium shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingFlags ? (
            <div className="glass-panel rounded-2xl p-16 text-center border border-white/10">
              <RefreshCw className="w-8 h-8 animate-spin text-rose-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-white">Loading review panel...</p>
            </div>
          ) : filteredFlags.length === 0 ? (
            <div className="glass-panel rounded-2xl p-16 text-center border border-white/10">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 stroke-[1.5]" />
              <h3 className="text-base font-semibold text-white">Queue completely cleared!</h3>
              <p className="text-xs text-slate-400 mt-1">No orders currently flag-restricted.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredFlags.map((flag) => {
                const order = flag.orders;
                if (!order) return null;
                const items = order.order_items || order.raw_parsed?.items || [];
                const rawText = order.whatsapp_messages?.raw_text || order.raw_parsed?.notes || "";
                const sigs = flag.raw_signals || {};
                const isPending = order.status === "pending_review";
                
                return (
                  <div
                    key={flag.id}
                    className={`glass-panel rounded-3xl p-6 border transition-all space-y-6 relative overflow-hidden ${
                      isPending ? "border-white/10" : "border-emerald-500/20 bg-emerald-950/5"
                    }`}
                  >
                    {/* Header: Customer Name and Severity */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-rose-400 shrink-0">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-base">
                              {order.customers?.name || "Customer"}
                            </h4>
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            Order Ref: {order.id.slice(0, 8)} • +{order.customers?.whatsapp_phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-xs text-slate-400">Severity:</span>
                        {getSeverityBadge(flag.severity)}
                        <span className="text-[11px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                          Conf: {(flag.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Split content: Left AI reasoning, Right signals & Items */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left: LLM reasoning box & recommended action */}
                      <div className="lg:col-span-7 space-y-4">
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Audit Reasoning</span>
                          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-sm text-slate-200 leading-relaxed font-sans">
                            {flag.llm_reasoning}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/30 p-3.5 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider block">Recommended Action</span>
                            <span className="inline-block mt-1.5 px-3 py-1 rounded-xl text-xs font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-white/10">
                              {flag.recommended_action.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="bg-black/30 p-3.5 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider block">Total Order Value</span>
                            <span className="block mt-1 text-lg font-bold text-white">
                              ₹{(order.total_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Raw Message Preview */}
                        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 text-xs">
                          <span className="text-slate-400 font-semibold block mb-1">Inbound WhatsApp Body:</span>
                          <span className="italic text-slate-300">&ldquo;{rawText}&rdquo;</span>
                        </div>
                      </div>

                      {/* Right: Detected statistical signals & Item breakdown */}
                      <div className="lg:col-span-5 space-y-4">
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit Alert Signals</span>
                          <div className="space-y-2">
                            {/* Z-score check */}
                            {sigs.value_zscore !== undefined && (
                              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 text-xs">
                                <span className="text-slate-400">Value Z-score Spike</span>
                                <span className={`font-mono font-bold ${sigs.value_spike ? "text-rose-400" : "text-slate-300"}`}>
                                  {sigs.value_zscore} {sigs.value_spike ? "🚨 (>2.5)" : "✓"}
                                </span>
                              </div>
                            )}

                            {/* Hour check */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 text-xs">
                              <span className="text-slate-400">Ordering Hour Check</span>
                              <span className={`font-mono font-bold ${sigs.unusual_time ? "text-amber-400" : "text-emerald-400"}`}>
                                {sigs.order_hour ? `${sigs.order_hour}:00` : "Unknown"} {sigs.unusual_time ? "⚠️ Unusual" : "✓ Normal"}
                              </span>
                            </div>

                            {/* Inventory Risk indicators */}
                            {sigs.inventory?.inventory_risks && sigs.inventory.inventory_risks.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                                <span className="text-rose-300 font-bold flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Stock Shortfall Flagged
                                </span>
                                {sigs.inventory.inventory_risks.map((risk: any, i: number) => (
                                  <div key={i} className="text-[11px] text-slate-300">
                                    • {risk.product}: requested {risk.requested}, available {risk.available} 
                                    {risk.shortfall > 0 && <span className="text-rose-400 font-bold ml-1">({risk.shortfall} shortage)</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* New items check */}
                            {sigs.new_items && sigs.new_items.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">New Items Detected</span>
                                  <span className="text-amber-400 font-bold font-mono">+{sigs.new_items.length} item(s)</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {sigs.new_items.map((it: string, i: number) => (
                                    <span key={i} className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">{it}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Quantity spikes */}
                            {sigs.item_quantity_spikes && sigs.item_quantity_spikes.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-xs space-y-1.5">
                                <span className="text-rose-300 font-semibold block">Quantity Spikes:</span>
                                {sigs.item_quantity_spikes.map((sp: any, i: number) => (
                                  <div key={i} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-1 last:border-0 last:pb-0">
                                    <span className="text-slate-400 truncate max-w-[150px]">{sp.item}</span>
                                    <span className="text-rose-400 font-mono font-bold">
                                      {sp.ordered_qty}x (Avg: {sp.avg_qty}x)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Order status indicators */}
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Line Items Ordered ({items.length})</span>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((item, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200"
                              >
                                <span className="font-bold text-slate-400 mr-1">{item.quantity} {item.unit || "unit"}</span>
                                {item.product_name_raw}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/10">
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <span>Audited using model:</span>
                        <code className="text-slate-400 font-mono">{flag.model_used}</code>
                      </div>

                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setDecisionFlag(flag);
                              setDecisionNotes("");
                            }}
                            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" /> Reject Order
                          </button>
                          
                          <button
                            onClick={() => startModify(flag)}
                            className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Modify Quantities
                          </button>

                          <button
                            onClick={() => handleDecision(flag.id, "approved")}
                            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 cursor-pointer"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" /> Approve Order
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-1">
                          ✓ This audit flag has been processed and closed.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Download PDF report form */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Generate Audit Summary PDF</h3>
                  <p className="text-xs text-slate-400">Download a ReportLab compiled document of orders, statuses, and AI signals.</p>
                </div>
              </div>

              <form onSubmit={handleDownloadReport} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Start Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">End Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={reportDownloading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  {reportDownloading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Compiling Report...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> Download Audit PDF
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Inventory shortage stats */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Active Stock Shortfalls</h3>
                  <p className="text-xs text-slate-400">Real-time alerts where order quantities exceed current manual stock levels.</p>
                </div>
              </div>

              <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2">
                {inventoryAlerts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-white/5 rounded-2xl border border-white/5">
                    ✓ All inventory stocks fully cleared.
                  </div>
                ) : (
                  inventoryAlerts.map((risk, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-black/30 border border-white/5 text-xs">
                      <div>
                        <span className="font-semibold text-white block">{risk.product}</span>
                        <span className="text-[10px] text-slate-400">Requested by: {risk.customer}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-rose-400 font-bold block">-{risk.shortfall} Units</span>
                        <span className="text-[10px] text-slate-400">In Stock: {risk.available}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 5. DECISION DRAWER / MODAL (APPROVE / REJECT / MODIFY CONTEXTS) */}
      {decisionFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-panel rounded-3xl max-w-xl w-full border border-white/15 p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {isModifying ? "Modify Order Items" : "Confirm Audit Decision"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Actioning flag review for client: {decisionFlag.orders?.customers?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setDecisionFlag(null);
                  setIsModifying(false);
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If Modifying layout */}
            {isModifying ? (
              <div className="space-y-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Line Item Quantity Adjustments</span>
                
                <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                  {modItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-white/5 gap-4">
                      <div className="truncate flex-1">
                        <p className="text-xs font-bold text-white truncate">{item.product_name_raw}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Unit size: {item.unit || "unit"}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateModQty(idx, Math.max(0, item.quantity - 1))}
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-slate-300 hover:bg-white/10"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateModQty(idx, Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-16 bg-black/60 border border-white/10 rounded-lg py-1 px-2 text-center text-xs text-white font-mono font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => updateModQty(idx, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-slate-300 hover:bg-white/10"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5 text-xs font-semibold">
                  <span className="text-slate-400">Total Adjusted Estimated Value:</span>
                  <span className="text-emerald-400 text-sm font-bold">₹{modTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  <span className="font-bold text-white block mb-0.5">Review Warning</span>
                  This will mark the order status as rejected. It will remain logged but won't be calculated into successful metrics groups.
                </div>
              </div>
            )}

            {/* Common Notes field */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Auditing Notes / Reason</label>
              <textarea
                value={decisionNotes}
                onChange={e => setDecisionNotes(e.target.value)}
                rows={3}
                placeholder={isModifying ? "Explain why you adjusted these quantities..." : "Provide audit rejection notes..."}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setDecisionFlag(null);
                  setIsModifying(false);
                }}
                className="bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                onClick={() => {
                  if (isModifying) {
                    handleDecision(decisionFlag.id, "modified", {
                      total_value: modTotal,
                      items: modItems
                    });
                  } else {
                    handleDecision(decisionFlag.id, "rejected");
                  }
                }}
                disabled={decisionLoading}
                className={`text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-lg cursor-pointer ${
                  isModifying 
                    ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/10" 
                    : "bg-rose-600 hover:bg-rose-500 shadow-rose-500/10"
                }`}
              >
                {decisionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recording...
                  </>
                ) : (
                  <>
                    {isModifying ? "Submit Modified Order" : "Confirm Rejection"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. GENERAL ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/15 p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Order Detail Breakdown</h3>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">Order ID: {selectedOrder.id}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer profile block */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-black/40 border border-white/10">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">Customer info</p>
                <p className="text-sm font-semibold text-white mt-1">{selectedOrder.customers?.name || "Customer"}</p>
                <p className="text-xs font-mono text-emerald-400 mt-0.5 flex items-center gap-1">
                  <PhoneCall className="w-3 h-3" /> +{selectedOrder.customers?.whatsapp_phone}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">Ingestion Details</p>
                <p className="text-xs text-slate-300 mt-1">
                  Time: {new Date(selectedOrder.created_at || selectedOrder.order_time).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Status: {selectedOrder.status}</p>
              </div>
            </div>

            {/* Raw Inbound Message block */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> Inbound WhatsApp Message
              </p>
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/20 to-black/60 border border-emerald-500/30 text-sm text-slate-200 font-sans leading-relaxed">
                &ldquo;{selectedOrder.whatsapp_messages?.raw_text || selectedOrder.raw_parsed?.notes || "No raw text recorded"}&rdquo;
              </div>
            </div>

            {/* Extracted Line Items table */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-400" /> AI Parsed Line Items
              </p>
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-slate-300 font-semibold">
                      <th className="p-3">Item Description</th>
                      <th className="p-3 text-center">Quantity</th>
                      <th className="p-3 text-center">Unit</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(selectedOrder.order_items || selectedOrder.raw_parsed?.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-medium text-white">{item.product_name_raw}</td>
                        <td className="p-3 text-center font-bold text-emerald-400">{item.quantity}</td>
                        <td className="p-3 text-center font-mono text-slate-400">{item.unit || "unit"}</td>
                        <td className="p-3 text-right text-slate-400">
                          {item.unit_price ? `₹${item.unit_price.toFixed(2)}` : "—"}
                        </td>
                        <td className="p-3 text-right font-semibold text-white">
                          {item.line_total ? `₹${item.line_total.toFixed(2)}` : (item.unit_price ? `₹${(item.quantity * item.unit_price).toFixed(2)}` : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/[0.03] font-bold text-white">
                      <td colSpan={4} className="p-3 text-right">Total:</td>
                      <td className="p-3 text-right text-emerald-400 text-sm">
                        ₹{(selectedOrder.total_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <span className="text-xs text-slate-500">
                Phase 2 audit workflow enabled • Approving updates order status in Supabase.
              </span>
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-5 py-2 rounded-xl transition-all cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
