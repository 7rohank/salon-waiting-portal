export type QueueStatus = "waiting" | "in_service" | "completed" | "cancelled";

export type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_label: string | null;
  active: boolean;
  sort_order: number;
  created_at?: string;
};

export type QueueEntry = {
  id: string;
  customer_name: string;
  phone: string | null;
  service_id: string | null;
  service_name: string | null;
  stylist_name: string | null;
  party_size: number;
  status: QueueStatus;
  notes: string | null;
  quoted_wait_minutes: number | null;
  position: number | null;
  created_at: string;
  updated_at: string;
  checked_in_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  services?: {
    name: string;
    duration_minutes: number;
  } | null;
};
