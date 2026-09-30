import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  type AppointmentRow,
  type AutomationRuleRow,
  type ContactRow,
  type ContactNoteRow,
  isSupabaseConfigured,
  type MessageLogRow,
  type SubscriptionRow,
  supabase,
  type TaskRow,
  type TransactionRow,
} from "./supabase";

export type NewContact = {
  fullName: string;
  email: string;
  phone: string;
  project: string;
};

export type NewTransaction = {
  contactId: string | null;
  contactName: string;
  propertyName: string;
  propertyLocation: string;
  stage: string;
  amount: number;
};

export type NewTask = { title: string; description: string; priority: TaskRow["priority"]; dueAt: string; contactId: string | null };
export type NewAppointment = { title: string; startAt: string; endAt: string; location: string; notes: string; contactId: string | null };

const makeInitials = (name: string) => name
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join("");

export type MessageRow = { id: string; organization_id: string; contact_id: string; direction: "inbound" | "outbound"; body: string; created_at: string };

export type PropertyRow = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  address: string;
  price: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqft: number | null;
  status: "Disponible" | "Sous offre" | "Vendue" | "Retirée";
  photo_url: string | null;
  description: string | null;
  created_at: string;
  // Champs "Immobilier International" (site public)
  slug: string | null;
  titre: string | null;
  pays: string | null;
  ville: string | null;
  region: string | null;
  drapeau: string | null;
  code_postal: string | null;
  devise: string | null;
  lat: number | null;
  lng: number | null;
  superficie_m2: number | null;
  caracteristiques: string[] | null;
  photos: string[] | null;
  statut: string | null;
  international: boolean;
  published: boolean;
  demo: boolean;
};

export type InternationalPropertyInput = {
  publier: boolean;
  slug: string;
  titre: string;
  pays: string;
  ville: string;
  region: string;
  drapeau: string;
  codePostal: string;
  devise: string;
  lat: number | null;
  lng: number | null;
  superficieM2: number | null;
  caracteristiques: string[];
  photos: string[];
  statut: string;
};

export type TeamMemberRow = { id: string; full_name: string; role: string; active: boolean; created_at: string };

export function useCrmData() {
  const [session, setSession] = useState<Session | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string>("immobilier");
  const [agencyName, setAgencyName] = useState<string>("");
  const [language, setLanguage] = useState<string>("fr");
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [deletedContacts, setDeletedContacts] = useState<ContactRow[]>([]);
  const [contactNotes, setContactNotes] = useState<ContactNoteRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRuleRow[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLogRow[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");

  const loadData = useCallback(async (activeSession: Session) => {
    if (!supabase) return;
    setLoading(true);
    setError("");

    const profileResult = await supabase
      .from("profiles")
      .select("organization_id, language, organizations(industry, name)")
      .eq("id", activeSession.user.id)
      .single();

    if (profileResult.error || !profileResult.data) {
      setError(profileResult.error?.message ?? "Profil d’agence introuvable.");
      setLoading(false);
      return;
    }

    setOrganizationId(profileResult.data.organization_id);
    setIndustry((profileResult.data as unknown as { organizations: { industry: string } }).organizations?.industry ?? "immobilier");
    setAgencyName((profileResult.data as unknown as { organizations: { name: string } }).organizations?.name ?? "");
    setLanguage(profileResult.data.language ?? "fr");
    const [contactsResult, deletedContactsResult, notesResult, messagesResult, teamResult, propertiesResult, transactionsResult, tasksResult, appointmentsResult, rulesResult, logsResult, subscriptionResult] = await Promise.all([
      supabase.from("contacts").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("contacts").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
      supabase.from("contact_notes").select("*").order("created_at", { ascending: false }),
      supabase.from("messages").select("*").order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name, role, active, created_at").order("created_at", { ascending: true }),
      supabase.from("properties").select("*").order("created_at", { ascending: false }),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("due_at", { ascending: true }),
      supabase.from("appointments").select("*").order("start_at", { ascending: true }),
      supabase.from("automation_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("message_logs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("subscriptions").select("*").maybeSingle(),
    ]);

    const firstError = contactsResult.error ?? deletedContactsResult.error ?? notesResult.error ?? messagesResult.error ?? teamResult.error ?? propertiesResult.error ?? transactionsResult.error ?? tasksResult.error ?? appointmentsResult.error ?? rulesResult.error ?? logsResult.error ?? subscriptionResult.error;
    if (firstError) setError(firstError.message);
    else {
      setContacts((contactsResult.data ?? []) as ContactRow[]);
      setDeletedContacts((deletedContactsResult.data ?? []) as ContactRow[]);
      setContactNotes((notesResult.data ?? []) as ContactNoteRow[]);
      setMessages((messagesResult.data ?? []) as MessageRow[]);
      setTeamMembers((teamResult.data ?? []) as TeamMemberRow[]);
      setProperties((propertiesResult.data ?? []) as PropertyRow[]);
      setTransactions((transactionsResult.data ?? []) as TransactionRow[]);
      setTasks((tasksResult.data ?? []) as TaskRow[]);
      setAppointments((appointmentsResult.data ?? []) as AppointmentRow[]);
      setAutomationRules((rulesResult.data ?? []) as AutomationRuleRow[]);
      setMessageLogs((logsResult.data ?? []) as MessageLogRow[]);
      setSubscription(subscriptionResult.data as SubscriptionRow | null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authError = hash.get("error_description");
    if (authError) {
      setError(authError.includes("expired")
        ? "Le lien de connexion a expiré ou a déjà été utilisé. Demandez un nouveau lien."
        : decodeURIComponent(authError.replace(/\+/g, " ")));
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void loadData(data.session);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(nextSession);
      if (nextSession) void loadData(nextSession);
      else {
        setOrganizationId(null);
        setContacts([]);
        setTransactions([]);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  const requireContext = () => {
    if (!supabase || !session || !organizationId) {
      throw new Error("Connectez-vous avant de modifier les données réelles.");
    }
    return { client: supabase, activeSession: session, activeOrganizationId: organizationId };
  };

  const signUpWithPassword = async (email: string, password: string, fullName: string, agencyName: string, industryValue: string, joinOrgId: string) => {
    if (!supabase) throw new Error("Supabase n’est pas configuré.");
    const { error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, agency_name: agencyName, industry: industryValue, join_org_id: joinOrgId || undefined } } });
    if (authError) throw authError;
  };

  const signInWithPassword = async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase n’est pas configuré.");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;
  };

  const resetPassword = async (email: string) => {
    if (!supabase) throw new Error("Supabase n’est pas configuré.");
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (authError) throw authError;
  };

  const updatePassword = async (newPassword: string) => {
    if (!supabase) throw new Error("Supabase n’est pas configuré.");
    if (newPassword.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) {
      if (authError.message.toLowerCase().includes("different from the old")) throw new Error("Le nouveau mot de passe doit être différent de l’ancien.");
      if (authError.message.toLowerCase().includes("weak")) throw new Error("Mot de passe trop faible : mélangez lettres, chiffres et symboles.");
      throw authError;
    }
    setPasswordRecovery(false);
  };

  const dismissPasswordRecovery = () => setPasswordRecovery(false);

  const sendMagicLink = async (email: string) => {
    if (!supabase) throw new Error("Supabase n’est pas encore configuré.");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: email.split("@")[0] },
      },
    });
    if (authError) throw authError;
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  const addContact = async (contact: NewContact) => {
    const { client, activeSession, activeOrganizationId } = requireContext();
    const { data, error: insertError } = await client
      .from("contacts")
      .insert({
        organization_id: activeOrganizationId,
        full_name: contact.fullName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim() || null,
        project: contact.project,
        status: "Nouveau",
        source: "Manuel",
        initials: makeInitials(contact.fullName),
        created_by: activeSession.user.id,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    setContacts((current) => [data as ContactRow, ...current]);
    return data as ContactRow;
  };

  const updateContactConsent = async (id: string, channel: "email" | "sms", consent: boolean) => {
    const { client } = requireContext();
    const field = channel === "email" ? "consent_email" : "consent_sms";
    const { error: updateError } = await client.from("contacts").update({ [field]: consent, ...(channel === "sms" && consent ? { unsubscribed_at: null } : {}) }).eq("id", id);
    if (updateError) throw updateError;
    setContacts((current) => current.map((contact) => contact.id === id ? { ...contact, [field]: consent } : contact));
  };

  const invokeAutomation = async (contactId: string, ruleId: string) => {
    const { client } = requireContext();
    const { data, error: invokeError } = await client.functions.invoke("send-automation", { body: { contactId, ruleId } });
    if (invokeError) throw invokeError;
    return data;
  };

  const createCheckout = async (plan: "solo" | "agency" | "pro_ai", interval: "monthly" | "yearly") => {
    const { client } = requireContext();
    const { data, error: invokeError } = await client.functions.invoke("create-checkout", { body: { plan, interval, returnUrl: window.location.origin } });
    if (invokeError) throw invokeError;
    if (!data?.url) throw new Error(data?.error ?? "Stripe n’est pas encore configuré.");
    window.location.assign(data.url);
  };

  const updateContactStatus = async (id: string, status: string) => {
    const { client } = requireContext();
    const { error: updateError } = await client.from("contacts").update({ status }).eq("id", id);
    if (updateError) throw updateError;
    setContacts((current) => current.map((contact) => contact.id === id ? { ...contact, status } : contact));
  };

  const updateContactTemperature = async (id: string, temperature: ContactRow["temperature"]) => {
    const { client } = requireContext();
    const { error: updateError } = await client.from("contacts").update({ temperature }).eq("id", id);
    if (updateError) throw updateError;
    setContacts((current) => current.map((contact) => contact.id === id ? { ...contact, temperature } : contact));
  };

  const updateLanguage = async (value: string) => {
    const { client, activeSession } = requireContext();
    const { error: updateError } = await client.from("profiles").update({ language: value }).eq("id", activeSession.user.id);
    if (updateError) throw updateError;
    setLanguage(value);
  };

  const softDeleteContact = async (id: string) => {
    const { client } = requireContext();
    const { error: updateError } = await client.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw updateError;
    setContacts((current) => {
      const moved = current.find((c) => c.id === id);
      if (moved) setDeletedContacts((trash) => [{ ...moved, deleted_at: new Date().toISOString() }, ...trash]);
      return current.filter((c) => c.id !== id);
    });
  };

  const restoreContact = async (id: string) => {
    const { client } = requireContext();
    const { error: updateError } = await client.from("contacts").update({ deleted_at: null }).eq("id", id);
    if (updateError) throw updateError;
    setDeletedContacts((current) => {
      const moved = current.find((c) => c.id === id);
      if (moved) setContacts((active) => [{ ...moved, deleted_at: null }, ...active]);
      return current.filter((c) => c.id !== id);
    });
  };

  const permanentlyDeleteContact = async (id: string) => {
    const { client } = requireContext();
    const { error: deleteError } = await client.from("contacts").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setDeletedContacts((current) => current.filter((c) => c.id !== id));
  };

  const emptyContactsTrash = async () => {
    const { client, activeOrganizationId } = requireContext();
    const { error: deleteError } = await client.from("contacts").delete().eq("organization_id", activeOrganizationId).not("deleted_at", "is", null);
    if (deleteError) throw deleteError;
    setDeletedContacts([]);
  };

  const assignContact = async (id: string, memberId: string | null) => {
    const { client } = requireContext();
    const { error: updateError } = await client.from("contacts").update({ assigned_to: memberId }).eq("id", id);
    if (updateError) throw updateError;
    setContacts((current) => current.map((c) => c.id === id ? { ...c, assigned_to: memberId } : c));
  };

  const removeTeamMember = async (id: string) => {
    const { client } = requireContext();
    const { error: updateError } = await client.from("profiles").update({ active: false, removed_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw updateError;
    setTeamMembers((current) => current.map((m) => m.id === id ? { ...m, active: false } : m));
  };

  const restoreTeamMember = async (id: string) => {
    const { client } = requireContext();
    const { error: updateError } = await client.from("profiles").update({ active: true, removed_at: null }).eq("id", id);
    if (updateError) throw updateError;
    setTeamMembers((current) => current.map((m) => m.id === id ? { ...m, active: true } : m));
  };

  const deleteTeamMemberForever = async (id: string) => {
    const { client } = requireContext();
    const { error: deleteError } = await client.from("profiles").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setTeamMembers((current) => current.filter((m) => m.id !== id));
  };

  const emptyTeamTrash = async () => {
    const { client, activeOrganizationId } = requireContext();
    const { error: deleteError } = await client.from("profiles").delete().eq("organization_id", activeOrganizationId).eq("active", false);
    if (deleteError) throw deleteError;
    setTeamMembers((current) => current.filter((m) => m.active));
  };

  const addContactNote = async (contactId: string, body: string) => {
    const { client, activeSession, activeOrganizationId } = requireContext();
    const { data, error: insertError } = await client
      .from("contact_notes")
      .insert({ organization_id: activeOrganizationId, contact_id: contactId, body: body.trim(), created_by: activeSession.user.id })
      .select()
      .single();
    if (insertError) throw insertError;
    setContactNotes((current) => [data as ContactNoteRow, ...current]);
    return data as ContactNoteRow;
  };

  const deleteContactNote = async (id: string) => {
    const { client } = requireContext();
    const { error: deleteError } = await client.from("contact_notes").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setContactNotes((current) => current.filter((note) => note.id !== id));
  };

  const deleteContact = async (id: string) => {
    const { client } = requireContext();
    const { error: deleteError } = await client.from("contacts").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setContacts((current) => current.filter((contact) => contact.id !== id));
  };

  const addTransaction = async (transaction: NewTransaction) => {
    const { client, activeSession, activeOrganizationId } = requireContext();
    const { data, error: insertError } = await client
      .from("transactions")
      .insert({
        organization_id: activeOrganizationId,
        contact_id: transaction.contactId,
        contact_name: transaction.contactName.trim(),
        property_name: transaction.propertyName.trim(),
        property_location: transaction.propertyLocation.trim(),
        stage: transaction.stage,
        amount: transaction.amount,
        initials: makeInitials(transaction.contactName),
        tone: "sand",
        last_activity: "À l’instant",
        created_by: activeSession.user.id,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    setTransactions((current) => [data as TransactionRow, ...current]);
    return data as TransactionRow;
  };

  const updateTransactionStage = async (id: string, stage: string) => {
    const { client } = requireContext();
    const { error: updateError } = await client
      .from("transactions")
      .update({ stage, last_activity: "À l’instant" })
      .eq("id", id);
    if (updateError) throw updateError;
    setTransactions((current) => current.map((transaction) => transaction.id === id
      ? { ...transaction, stage, last_activity: "À l’instant" }
      : transaction));
  };

  const deleteTransaction = async (id: string) => {
    const { client } = requireContext();
    const { error: deleteError } = await client.from("transactions").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setTransactions((current) => current.filter((transaction) => transaction.id !== id));
  };

  const addTask = async (task: NewTask) => {
    const { client, activeSession, activeOrganizationId } = requireContext();
    const { data, error: operationError } = await client.from("tasks").insert({ organization_id: activeOrganizationId, contact_id: task.contactId, title: task.title, description: task.description, priority: task.priority, due_at: new Date(task.dueAt).toISOString(), created_by: activeSession.user.id }).select().single();
    if (operationError) throw operationError;
    setTasks((current) => [...current, data as TaskRow].sort((a, b) => a.due_at.localeCompare(b.due_at)));
  };

  const toggleTask = async (id: string, completed: boolean) => {
    const { client } = requireContext();
    const values = { status: completed ? "done" : "todo", completed_at: completed ? new Date().toISOString() : null };
    const { error: operationError } = await client.from("tasks").update(values).eq("id", id);
    if (operationError) throw operationError;
    setTasks((current) => current.map((task) => task.id === id ? { ...task, ...values } as TaskRow : task));
  };

  const deleteTask = async (id: string) => {
    const { client } = requireContext();
    const { error: operationError } = await client.from("tasks").delete().eq("id", id);
    if (operationError) throw operationError;
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  const deleteAppointment = async (id: string) => {
    const { client } = requireContext();
    const { error: operationError } = await client.from("appointments").delete().eq("id", id);
    if (operationError) throw operationError;
    setAppointments((current) => current.filter((item) => item.id !== id));
  };

  const addAppointment = async (appointment: NewAppointment) => {
    const { client, activeSession, activeOrganizationId } = requireContext();
    const { data, error: operationError } = await client.from("appointments").insert({ organization_id: activeOrganizationId, contact_id: appointment.contactId, title: appointment.title, start_at: new Date(appointment.startAt).toISOString(), end_at: new Date(appointment.endAt).toISOString(), location: appointment.location, notes: appointment.notes, created_by: activeSession.user.id }).select().single();
    if (operationError) throw operationError;
    setAppointments((current) => [...current, data as AppointmentRow].sort((a, b) => a.start_at.localeCompare(b.start_at)));
  };

  const toggleAutomationRule = async (id: string, active: boolean) => {
    const { client } = requireContext();
    const { error: operationError } = await client.from("automation_rules").update({ active }).eq("id", id);
    if (operationError) throw operationError;
    setAutomationRules((current) => current.map((rule) => rule.id === id ? { ...rule, active } : rule));
  };

  const addProperty = async (input: { address: string; price: string; propertyType: string; bedrooms: number | null; bathrooms: number | null; areaSqft: number | null; photoUrl: string; description: string; contactId: string | null; international?: InternationalPropertyInput | null }) => {
    const { client, activeSession, activeOrganizationId } = requireContext();
    const intl = input.international;
    const { data, error: insertError } = await client
      .from("properties")
      .insert({
        organization_id: activeOrganizationId,
        contact_id: input.contactId,
        address: input.address,
        price: input.price || null,
        property_type: input.propertyType || null,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        area_sqft: input.areaSqft,
        photo_url: input.photoUrl || null,
        description: input.description || null,
        created_by: activeSession.user.id,
        ...(intl
          ? {
              slug: intl.slug || null,
              titre: intl.titre || null,
              pays: intl.pays || null,
              ville: intl.ville || null,
              region: intl.region || null,
              drapeau: intl.drapeau || null,
              code_postal: intl.codePostal || null,
              devise: intl.devise || null,
              lat: intl.lat,
              lng: intl.lng,
              superficie_m2: intl.superficieM2,
              caracteristiques: intl.caracteristiques,
              photos: intl.photos,
              statut: intl.statut || null,
              international: intl.publier,
              published: intl.publier,
              demo: false,
            }
          : {}),
      })
      .select()
      .single();
    if (insertError) throw insertError;
    setProperties((current) => [data as PropertyRow, ...current]);
  };

  const updateProperty = async (id: string, input: { address: string; price: string; propertyType: string; bedrooms: number | null; bathrooms: number | null; areaSqft: number | null; photoUrl: string; description: string; contactId: string | null; international?: InternationalPropertyInput | null }) => {
    const { client } = requireContext();
    const intl = input.international;
    const { data, error: updateError } = await client
      .from("properties")
      .update({
        contact_id: input.contactId,
        address: input.address,
        price: input.price || null,
        property_type: input.propertyType || null,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        area_sqft: input.areaSqft,
        photo_url: input.photoUrl || null,
        description: input.description || null,
        updated_at: new Date().toISOString(),
        ...(intl
          ? {
              slug: intl.slug || null,
              titre: intl.titre || null,
              pays: intl.pays || null,
              ville: intl.ville || null,
              region: intl.region || null,
              drapeau: intl.drapeau || null,
              code_postal: intl.codePostal || null,
              devise: intl.devise || null,
              lat: intl.lat,
              lng: intl.lng,
              superficie_m2: intl.superficieM2,
              caracteristiques: intl.caracteristiques,
              photos: intl.photos,
              statut: intl.statut || null,
              international: intl.publier,
              published: intl.publier,
            }
          : { international: false, published: false }),
      })
      .eq("id", id)
      .select()
      .single();
    if (updateError) throw updateError;
    setProperties((current) => current.map((p) => (p.id === id ? (data as PropertyRow) : p)));
  };

  const updatePropertyStatus = async (id: string, status: PropertyRow["status"]) => {
    const { client } = requireContext();
    const { error: updateError } = await client.from("properties").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw updateError;
    setProperties((current) => current.map((p) => p.id === id ? { ...p, status } : p));
  };

  const deleteProperty = async (id: string) => {
    const { client } = requireContext();
    const { error: deleteError } = await client.from("properties").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setProperties((current) => current.filter((p) => p.id !== id));
  };

  const addAutomationRule = async (input: { name: string; channel: string; delayDays: number; template: string; consentRequired: boolean }) => {
    const { client, activeSession, activeOrganizationId } = requireContext();
    const { data, error: insertError } = await client
      .from("automation_rules")
      .insert({
        organization_id: activeOrganizationId,
        name: input.name,
        channel: input.channel,
        trigger_type: "inactivity",
        delay_minutes: input.delayDays * 1440,
        template: input.template,
        active: true,
        ai_enabled: false,
        consent_required: input.consentRequired,
        created_by: activeSession.user.id,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    setAutomationRules((current) => [data as AutomationRuleRow, ...current]);
  };

  const deleteAutomationRule = async (id: string) => {
    const { client } = requireContext();
    const { error: deleteError } = await client.from("automation_rules").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setAutomationRules((current) => current.filter((rule) => rule.id !== id));
  };

  return {
    configured: isSupabaseConfigured,
    session,
    industry,
    agencyName,
    language,
    organizationId,
    teamMembers,
    properties,
    contacts,
    contactNotes,
    messages,
    transactions,
    tasks,
    appointments,
    automationRules,
    messageLogs,
    subscription,
    loading,
    error,
    signUpWithPassword,
    signInWithPassword,
    resetPassword,
    updatePassword,
    passwordRecovery,
    dismissPasswordRecovery,
    sendMagicLink,
    signOut,
    addContact,
    updateContactConsent,
    invokeAutomation,
    createCheckout,
    updateContactStatus,
    updateContactTemperature,
    updateLanguage,
    softDeleteContact,
    restoreContact,
    permanentlyDeleteContact,
    emptyContactsTrash,
    assignContact,
    removeTeamMember,
    restoreTeamMember,
    deleteTeamMemberForever,
    emptyTeamTrash,
    deletedContacts,
    addContactNote,
    deleteContactNote,
    deleteContact,
    addTransaction,
    updateTransactionStage,
    deleteTransaction,
    addTask,
    toggleTask,
    deleteTask,
    deleteAppointment,
    addAppointment,
    toggleAutomationRule,
    addAutomationRule,
    deleteAutomationRule,
    addProperty,
    updateProperty,
    updatePropertyStatus,
    deleteProperty,
    refresh: () => session && loadData(session),
  };
}
