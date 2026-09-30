import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type ContactRow = {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  project: string;
  status: string;
  temperature: "Chaud" | "Tiède" | "Froid" | null;
  initials: string;
  consent_email: boolean;
  consent_sms: boolean;
  unsubscribed_at: string | null;
  source: string | null;
  budget: string | null;
  type_propriete: string | null;
  secteur: string | null;
  echeancier: string | null;
  preapprobation: string | null;
  adresse_propriete: string | null;
  prix_souhaite: string | null;
  qualification_resume: string | null;
  qualification_action: string | null;
  deleted_at: string | null;
  assigned_to: string | null;
  created_at: string;
};

export type ContactNoteRow = {
  id: string;
  organization_id: string;
  contact_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type TransactionRow = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  contact_name: string;
  property_name: string;
  property_location: string;
  stage: string;
  amount: number;
  initials: string;
  tone: string;
  last_activity: string | null;
  created_at: string;
};

export type TaskRow = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  due_at: string;
  completed_at: string | null;
  created_at: string;
};

export type AppointmentRow = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  title: string;
  start_at: string;
  end_at: string;
  location: string;
  notes: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
  created_at: string;
};

export type AutomationRuleRow = {
  id: string;
  organization_id: string;
  name: string;
  channel: "email" | "sms";
  trigger_type:
    | "manual"
    | "inactivity"
    | "stage_change"
    | "appointment_reminder";
  delay_minutes: number;
  template: string;
  active: boolean;
  ai_enabled: boolean;
  consent_required: boolean;
  created_at: string;
};

export type MessageLogRow = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  channel: "email" | "sms";
  provider: string;
  status: string;
  body: string;
  error: string | null;
  created_at: string;
};

export type SubscriptionRow = {
  id: string;
  organization_id: string;
  plan: "trial" | "solo" | "agency" | "pro_ai";
  status: string;
  billing_interval: "monthly" | "yearly";
  period_end: string | null;
};
