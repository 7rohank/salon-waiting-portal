"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  Clock3,
  Loader2,
  Phone,
  Play,
  RefreshCw,
  Scissors,
  Timer,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { QueueEntry, QueueStatus, Service } from "@/lib/types";

const fallbackServices: Service[] = [
  {
    id: "demo-cut",
    name: "Haircut",
    duration_minutes: 35,
    price_label: "from $35",
    active: true,
    sort_order: 1,
  },
  {
    id: "demo-color",
    name: "Color consult",
    duration_minutes: 50,
    price_label: "from $85",
    active: true,
    sort_order: 2,
  },
  {
    id: "demo-beard",
    name: "Beard trim",
    duration_minutes: 20,
    price_label: "from $20",
    active: true,
    sort_order: 3,
  },
];

const statusLabels: Record<QueueStatus, string> = {
  waiting: "Waiting",
  in_service: "In chair",
  completed: "Done",
  cancelled: "Cancelled",
};

type GuestForm = {
  customer_name: string;
  phone: string;
  service_id: string;
  stylist_name: string;
  party_size: number;
  notes: string;
};

const emptyForm: GuestForm = {
  customer_name: "",
  phone: "",
  service_id: "",
  stylist_name: "Any stylist",
  party_size: 1,
  notes: "",
};

function minutesSince(value: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
}

function timeLabel(value: string | null) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function entryServiceName(entry: QueueEntry) {
  return entry.services?.name || entry.service_name || "Walk-in service";
}

function entryDuration(entry: QueueEntry) {
  return entry.services?.duration_minutes || entry.quoted_wait_minutes || 30;
}

export default function Home() {
  const [services, setServices] = useState<Service[]>(fallbackServices);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [history, setHistory] = useState<QueueEntry[]>([]);
  const [form, setForm] = useState<GuestForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState(false);

  const waiting = useMemo(
    () => entries.filter((entry) => entry.status === "waiting"),
    [entries],
  );

  const inService = useMemo(
    () => entries.filter((entry) => entry.status === "in_service"),
    [entries],
  );

  const estimatedQueueMinutes = useMemo(() => {
    return waiting.reduce((total, entry) => total + Math.max(15, entryDuration(entry)), 0);
  }, [waiting]);

  const nextGuest = waiting[0];
  const selectedService =
    services.find((service) => service.id === form.service_id) || services[0];

  async function loadServices() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("services")
      .select("id, name, duration_minutes, price_label, active, sort_order, created_at")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      setNotice("Supabase is connected, but the database tables are not ready yet.");
      return;
    }

    if (data?.length) {
      setServices(data);
      setForm((current) => ({
        ...current,
        service_id: current.service_id || data[0].id,
      }));
      setDataReady(true);
    }
  }

  async function loadQueue() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const activeQuery = supabase
      .from("queue_entries")
      .select("*, services(name, duration_minutes)")
      .in("status", ["waiting", "in_service"])
      .order("created_at", { ascending: true });

    const historyQuery = supabase
      .from("queue_entries")
      .select("*, services(name, duration_minutes)")
      .in("status", ["completed", "cancelled"])
      .order("updated_at", { ascending: false })
      .limit(8);

    const [activeResult, historyResult] = await Promise.all([activeQuery, historyQuery]);

    if (activeResult.error) {
      setNotice("Run the Supabase SQL setup, then refresh this page.");
      setEntries([]);
      setHistory([]);
      setLoading(false);
      return;
    }

    setEntries((activeResult.data || []) as QueueEntry[]);
    setHistory((historyResult.data || []) as QueueEntry[]);
    setDataReady(true);
    setLoading(false);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setNotice("Add Supabase URL and anon key to .env.local to enable live data.");
      setLoading(false);
      return;
    }

    loadServices();
    loadQueue();

    if (!supabase) return;

    const channel = supabase
      .channel("queue-entries")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        () => loadQueue(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!form.service_id && services.length) {
      setForm((current) => ({ ...current, service_id: services[0].id }));
    }
  }, [form.service_id, services]);

  async function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !form.customer_name.trim()) return;

    setSaving(true);
    setNotice(null);

    const isDemoService = form.service_id.startsWith("demo-");
    const serviceName = selectedService?.name || "Walk-in service";
    const waitMinutes = waiting.length * Math.max(15, selectedService?.duration_minutes || 30);

    const { error } = await supabase.from("queue_entries").insert({
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim() || null,
      service_id: isDemoService ? null : form.service_id,
      service_name: serviceName,
      stylist_name: form.stylist_name.trim() || "Any stylist",
      party_size: form.party_size,
      notes: form.notes.trim() || null,
      quoted_wait_minutes: waitMinutes,
      position: waiting.length + 1,
      status: "waiting",
      checked_in_at: new Date().toISOString(),
    });

    if (error) {
      setNotice(error.message);
    } else {
      setForm({
        ...emptyForm,
        service_id: services[0]?.id || "",
      });
      await loadQueue();
    }

    setSaving(false);
  }

  async function updateStatus(entry: QueueEntry, status: QueueStatus) {
    if (!supabase) return;

    const now = new Date().toISOString();
    const updates: Partial<QueueEntry> = {
      status,
      updated_at: now,
    };

    if (status === "in_service") updates.started_at = now;
    if (status === "completed") updates.completed_at = now;
    if (status === "cancelled") updates.cancelled_at = now;

    const { error } = await supabase
      .from("queue_entries")
      .update(updates)
      .eq("id", entry.id);

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadQueue();
  }

  return (
    <main className="shell">
      <section className="workspace-header">
        <div className="header-copy">
          <div className="eyebrow">
            <Scissors size={16} aria-hidden="true" />
            Studio operations
          </div>
          <h1>Salon Waiting Portal</h1>
          <p>
            A polished front-desk queue for walk-ins, chair flow, service timing,
            and guest status across a busy salon floor.
          </p>
        </div>
        <div className="visual-frame" aria-hidden="true">
          <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80" alt="" />
        </div>
      </section>

      {notice ? (
        <div className="notice" role="status">
          <CircleDot size={18} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      <section className="metrics" aria-label="Queue summary">
        <article>
          <span className="metric-label">Waiting</span>
          <strong>{waiting.length}</strong>
          <small>{nextGuest ? nextGuest.customer_name + " is next" : "Queue is clear"}</small>
        </article>
        <article>
          <span className="metric-label">In service</span>
          <strong>{inService.length}</strong>
          <small>{inService.length ? "Chairs are active" : "No active chairs"}</small>
        </article>
        <article>
          <span className="metric-label">Quoted wait</span>
          <strong>{estimatedQueueMinutes}</strong>
          <small>minutes across the queue</small>
        </article>
      </section>

      <section className="workspace-grid">
        <form className="entry-panel" onSubmit={addGuest}>
          <div className="panel-heading">
            <div>
              <span className="kicker">Front desk</span>
              <h2>Add guest</h2>
            </div>
            <UserPlus size={22} aria-hidden="true" />
          </div>

          <label>
            Guest name
            <input
              value={form.customer_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, customer_name: event.target.value }))
              }
              placeholder="Riya Sharma"
              required
            />
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="+91 98765 43210"
              inputMode="tel"
            />
          </label>

          <label>
            Service
            <select
              value={form.service_id}
              onChange={(event) =>
                setForm((current) => ({ ...current, service_id: event.target.value }))
              }
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} - {service.duration_minutes} min
                </option>
              ))}
            </select>
          </label>

          <div className="field-row">
            <label>
              Stylist
              <input
                value={form.stylist_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, stylist_name: event.target.value }))
                }
                placeholder="Any stylist"
              />
            </label>
            <label>
              Guests
              <input
                type="number"
                min="1"
                max="8"
                value={form.party_size}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    party_size: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Preferred stylist, allergies, special request"
              rows={3}
            />
          </label>

          <button className="primary-action" type="submit" disabled={saving || !supabase}>
            {saving ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}
            <span>{saving ? "Adding guest" : "Add to queue"}</span>
          </button>

          <p className="setup-note">
            {dataReady
              ? "Live Supabase data is active."
              : "Run the Supabase schema to turn on live queue storage."}
          </p>
        </form>

        <section className="queue-panel" aria-label="Current queue">
          <div className="panel-heading">
            <div>
              <span className="kicker">Today</span>
              <h2>Waiting list</h2>
            </div>
            <button className="icon-button" type="button" onClick={loadQueue} aria-label="Refresh queue">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>

          {loading ? (
            <div className="empty-state">
              <Loader2 className="spin" size={26} aria-hidden="true" />
              <p>Loading queue...</p>
            </div>
          ) : entries.length ? (
            <div className="queue-list">
              {entries.map((entry, index) => (
                <article className="queue-row" key={entry.id}>
                  <div className="queue-rank">{entry.status === "waiting" ? index + 1 : "*"}</div>
                  <div className="guest-main">
                    <div className="guest-title">
                      <h3>{entry.customer_name}</h3>
                      <span className={"status-pill " + entry.status}>
                        {statusLabels[entry.status]}
                      </span>
                    </div>
                    <div className="guest-details">
                      <span>
                        <Scissors size={14} aria-hidden="true" />
                        {entryServiceName(entry)}
                      </span>
                      <span>
                        <Users size={14} aria-hidden="true" />
                        {entry.party_size}
                      </span>
                      <span>
                        <Clock3 size={14} aria-hidden="true" />
                        {minutesSince(entry.checked_in_at || entry.created_at)} min here
                      </span>
                      {entry.phone ? (
                        <span>
                          <Phone size={14} aria-hidden="true" />
                          {entry.phone}
                        </span>
                      ) : null}
                    </div>
                    {entry.notes ? <p className="guest-notes">{entry.notes}</p> : null}
                  </div>
                  <div className="row-actions">
                    {entry.status === "waiting" ? (
                      <button type="button" onClick={() => updateStatus(entry, "in_service")}>
                        <Play size={16} aria-hidden="true" />
                        <span>Seat</span>
                      </button>
                    ) : null}
                    <button type="button" onClick={() => updateStatus(entry, "completed")}>
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>Done</span>
                    </button>
                    <button type="button" onClick={() => updateStatus(entry, "cancelled")}>
                      <XCircle size={16} aria-hidden="true" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Timer size={28} aria-hidden="true" />
              <p>No one is waiting right now.</p>
            </div>
          )}
        </section>
      </section>

      <section className="history-panel" aria-label="Recent completed guests">
        <div className="panel-heading">
          <div>
            <span className="kicker">Recent</span>
            <h2>Completed and cancelled</h2>
          </div>
          <Clock3 size={20} aria-hidden="true" />
        </div>
        {history.length ? (
          <div className="history-list">
            {history.map((entry) => (
              <div className="history-row" key={entry.id}>
                <span>{entry.customer_name}</span>
                <span>{entryServiceName(entry)}</span>
                <span className={"status-pill " + entry.status}>{statusLabels[entry.status]}</span>
                <span>{timeLabel(entry.updated_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="quiet">Finished guests will appear here after the first updates.</p>
        )}
      </section>
    </main>
  );
}
