"use client";

import React, { useState, useEffect } from "react";
import { Activity } from "lucide-react";

export default function Header() {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">N</div>
        <span>Nudge</span>
        <span style={{ color: "var(--color-text-muted)", fontWeight: 400, marginLeft: 4 }}>Audit Ledger</span>
      </div>
      <div className="topbar-right">
        {mounted && (
          <div className="pill-badge">
            <span className="dot"></span>
            LangGraph Agent Active
          </div>
        )}
      </div>
    </header>
  );
}
