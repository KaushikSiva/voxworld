"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DemoEvent } from "@/lib/types";

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function DebugPage() {
  const [events, setEvents] = useState<DemoEvent[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("humanvoice-debug-events");
      if (!raw) {
        return;
      }
      setEvents(JSON.parse(raw) as DemoEvent[]);
    } catch {
      setEvents([]);
    }
  }, []);

  return (
    <main className="page-shell debug-shell">
      <section className="main-grid debug-grid">
        <article className="panel">
          <div className="panel-inner">
            <div className="panel-header">
              <div className="panel-header-copy">
                <p className="eyebrow">Debug Log</p>
                <h2>HumanVoice Event Timeline</h2>
                <p className="section-note">A clean event trace for demos, debugging, and narration prep.</p>
              </div>
              <Link className="button-secondary debug-back" href="/">
                Back to Demo
              </Link>
            </div>
            <div className="log-list">
              {events.length ? (
                events.map((entry) => (
                  <div key={entry.id} className="log-item">
                    <strong>{entry.title}</strong>
                    <div>{entry.detail}</div>
                    <div className="log-time">
                      {entry.stage} • {formatTime(entry.timestamp)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="transcript">No debug events recorded yet.</div>
              )}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
