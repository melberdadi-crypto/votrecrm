import { useMemo, useState } from "react";
import { type InternationalPropertyInput, type PropertyRow, type TeamMemberRow, useCrmData } from "./lib/useCrmData";
import { ContentView } from "./ContentView";
import { VideoStudio } from "./video/VideoStudio";
import {
  ArrowLeftFromLine,
  ArrowRight,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Command,
  ContactRound,
  CreditCard,
  Copy,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  Target,
  Thermometer,
  Trash2,
  TrendingUp,
  UsersRound,
  UserMinus,
  X,
  Megaphone,
  Clapperboard,
  Globe2,
  Pencil,
  ExternalLink,
} from "lucide-react";

type Page = "Aperçu" | "Pipeline" | "Contacts" | "Conversations SMS" | "Propriétés" | "Tâches" | "Automatisations" | "Contenu" | "Studio vidéo" | "Équipe" | "Forfaits" | "Paramètres";

type Deal = {
  id: string;
  name: string;
  property: string;
  value: string;
  amount: number;
  initials: string;
  tone: string;
  days?: string;
};

type PipelineColumn = { label: string; value: string; color: string; deals: Deal[] };
type UiContact = { id: string; name: string; role: string; phone: string; email: string; status: string; temperature: "Chaud" | "Tiède" | "Froid" | null; initials: string; consentEmail?: boolean; consentSms?: boolean; source?: string | null; budget?: string | null; typePropriete?: string | null; secteur?: string | null; echeancier?: string | null; preapprobation?: string | null; adresseTexte?: string | null; prixSouhaite?: string | null; qualificationResume?: string | null; qualificationAction?: string | null; assignedTo?: string | null };
type UiNote = { id: string; contactId: string; body: string; createdAt: string };
type UiMessage = { id: string; contactId: string; direction: "inbound" | "outbound"; body: string; createdAt: string };

const translations: Record<string, Record<string, string>> = {
  fr: { "Aperçu": "Aperçu", "Pipeline": "Pipeline", "Contacts": "Contacts", "Conversations SMS": "Conversations SMS", "Propriétés": "Propriétés", "Tâches": "Tâches", "Automatisations": "Automatisations", "Contenu": "Contenu", "Studio vidéo": "Studio vidéo", "Équipe": "Équipe", "Forfaits": "Forfaits", "Paramètres": "Paramètres", "Déconnexion": "Déconnexion", "Nouveau contact": "Nouveau contact" },
  en: { "Aperçu": "Overview", "Pipeline": "Pipeline", "Contacts": "Contacts", "Conversations SMS": "SMS Conversations", "Propriétés": "Properties", "Tâches": "Tasks", "Automatisations": "Automations", "Contenu": "Content", "Studio vidéo": "Video studio", "Équipe": "Team", "Forfaits": "Plans", "Paramètres": "Settings", "Déconnexion": "Log out", "Nouveau contact": "New contact" },
  ar: { "Aperçu": "نظرة عامة", "Pipeline": "خط الأنابيب", "Contacts": "جهات الاتصال", "Conversations SMS": "محادثات الرسائل", "Propriétés": "العقارات", "Tâches": "المهام", "Automatisations": "الأتمتة", "Contenu": "المحتوى", "Studio vidéo": "استوديو الفيديو", "Équipe": "الفريق", "Forfaits": "الباقات", "Paramètres": "الإعدادات", "Déconnexion": "تسجيل الخروج", "Nouveau contact": "جهة اتصال جديدة" },
};

export const industryConfig: Record<string, { roleA: string; roleB: string; projectOptions: string[]; propertiesLabel: string; contactWord: string }> = {
  immobilier: { roleA: "Acheteurs", roleB: "Vendeurs", projectOptions: ["Achat", "Vente", "Estimation"], propertiesLabel: "Propriétés", contactWord: "lead" },
  sante: { roleA: "Nouveaux patients", roleB: "Suivis", projectOptions: ["Consultation", "Suivi", "Bilan"], propertiesLabel: "Services", contactWord: "patient" },
  esthetique: { roleA: "Nouvelles clientes", roleB: "Clientes fidèles", projectOptions: ["Soin", "Forfait", "Consultation"], propertiesLabel: "Soins", contactWord: "cliente" },
  conciergerie: { roleA: "Nouvelles demandes", roleB: "Clients réguliers", projectOptions: ["Demande ponctuelle", "Forfait mensuel", "Événement"], propertiesLabel: "Services", contactWord: "client" },
};

const navigation: { label: Page; icon: typeof Home; count?: string }[] = [
  { label: "Aperçu", icon: LayoutDashboard },
  { label: "Pipeline", icon: Target, count: "12" },
  { label: "Contacts", icon: ContactRound },
  { label: "Conversations SMS", icon: MessageSquareText },
  { label: "Propriétés", icon: Building2 },
  { label: "Tâches", icon: CalendarDays, count: "5" },
  { label: "Automatisations", icon: Bot },
  { label: "Contenu", icon: Megaphone },
  { label: "Studio vidéo", icon: Clapperboard },
  { label: "Équipe", icon: UsersRound },
  { label: "Forfaits", icon: CreditCard },
  { label: "Paramètres", icon: Settings },
];

const demoPipeline: PipelineColumn[] = [
  {
    label: "Nouveaux prospects",
    value: "1,24 M€",
    color: "#d38b5d",
    deals: [
      { id: "demo-1", name: "Claire Bernard", property: "Appartement · Lyon 6e", value: "475 000 €", amount: 475000, initials: "CB", tone: "sand", days: "Aujourd’hui" },
      { id: "demo-2", name: "Thomas & Léa", property: "Maison · Écully", value: "690 000 €", amount: 690000, initials: "TL", tone: "olive", days: "Hier" },
    ],
  },
  {
    label: "Visite planifiée",
    value: "885 k€",
    color: "#d3ab59",
    deals: [
      { id: "demo-3", name: "Marc Delon", property: "Loft · Croix-Rousse", value: "520 000 €", amount: 520000, initials: "MD", tone: "clay", days: "2 jours" },
      { id: "demo-4", name: "Alice Fontaine", property: "T3 · Villeurbanne", value: "365 000 €", amount: 365000, initials: "AF", tone: "rose", days: "3 jours" },
    ],
  },
  {
    label: "Offre déposée",
    value: "1,12 M€",
    color: "#71856c",
    deals: [
      { id: "demo-5", name: "Louis Martin", property: "Maison · Caluire", value: "745 000 €", amount: 745000, initials: "LM", tone: "olive", days: "4 jours" },
      { id: "demo-6", name: "Julie Perrin", property: "Duplex · Lyon 2e", value: "380 000 €", amount: 380000, initials: "JP", tone: "sand", days: "5 jours" },
    ],
  },
  {
    label: "Signature",
    value: "940 k€",
    color: "#254f46",
    deals: [
      { id: "demo-7", name: "Sophie Robert", property: "Villa · Saint-Didier", value: "940 000 €", amount: 940000, initials: "SR", tone: "forest", days: "8 jours" },
    ],
  },
];

const properties = [
  { name: "Villa des Monts", place: "Saint-Didier-au-Mont-d'Or", price: "940 000 €", tag: "Sous offre", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=85" },
  { name: "Loft Canut", place: "Lyon · Croix-Rousse", price: "520 000 €", tag: "Visite", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85" },
  { name: "Maison des Cèdres", place: "Écully", price: "690 000 €", tag: "Nouveau", image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=900&q=85" },
];

const demoContacts: UiContact[] = [
  { id: "contact-1", name: "Claire Bernard", role: "Acquéreuse", phone: "06 24 18 52 70", email: "claire.bernard@email.fr", status: "À relancer", temperature: "Chaud", initials: "CB" },
  { id: "contact-2", name: "Louis Martin", role: "Acquéreur", phone: "06 80 32 44 16", email: "louis.martin@email.fr", status: "Offre déposée", temperature: "Chaud", initials: "LM" },
  { id: "contact-3", name: "Sophie Robert", role: "Vendeuse", phone: "07 15 72 39 48", email: "sophie.robert@email.fr", status: "Signature", temperature: "Tiède", initials: "SR" },
  { id: "contact-4", name: "Alice Fontaine", role: "Acquéreuse", phone: "06 09 43 68 21", email: "alice.fontaine@email.fr", status: "Visite", temperature: "Froid", initials: "AF" },
];

const demoNotes: UiNote[] = [
  { id: "note-1", contactId: "contact-1", body: "Rappelée le 12 — cherche un 3 pièces avec balcon, budget confirmé.", createdAt: "2026-09-12T10:00:00" },
];

const demoMessages: UiMessage[] = [
  { id: "msg-1", contactId: "contact-1", direction: "outbound", body: "Bonjour Claire! Merci pour votre demande. Quel est votre budget approximatif?", createdAt: "2026-09-12T09:00:00" },
  { id: "msg-2", contactId: "contact-1", direction: "inbound", body: "Bonjour, autour de 450 000$ pour un 3 pièces avec balcon.", createdAt: "2026-09-12T09:05:00" },
  { id: "msg-3", contactId: "contact-1", direction: "outbound", body: "Parfait, merci! Dans quel secteur cherchez-vous?", createdAt: "2026-09-12T09:06:00" },
];

type UiTask = { id: string; title: string; description: string; dueAt: string; priority: "low" | "normal" | "high" | "urgent"; done: boolean; contactId: string | null };
type UiAppointment = { id: string; title: string; startAt: string; endAt: string; location: string; status: string; contactId: string | null };
type UiAutomation = { id: string; name: string; channel: "email" | "sms"; trigger: string; active: boolean; ai: boolean; template: string };

const tasks = [
  { title: "Rappeler Claire Bernard", meta: "Appartement Lyon 6e", time: "09:30", urgent: true },
  { title: "Préparer le dossier de vente", meta: "Villa des Monts", time: "11:00", urgent: false },
  { title: "Visite avec Marc Delon", meta: "Loft Canut · Croix-Rousse", time: "14:30", urgent: false },
  { title: "Envoyer le mandat à signer", meta: "Maison des Cèdres", time: "16:00", urgent: true },
];

const demoTaskData: UiTask[] = tasks.map((task, index) => ({ id: `task-${index}`, title: task.title, description: task.meta, dueAt: `2026-09-18T${task.time}`, priority: task.urgent ? "urgent" : "normal", done: false, contactId: null }));
const demoAppointmentData: UiAppointment[] = [
  { id: "appointment-1", title: "Visite Villa des Monts", startAt: "2026-09-18T14:30", endAt: "2026-09-18T15:30", location: "Saint-Didier-au-Mont-d'Or", status: "confirmed", contactId: null },
  { id: "appointment-2", title: "Signature compromis", startAt: "2026-09-19T10:00", endAt: "2026-09-19T11:00", location: "Étude notariale, Lyon 2e", status: "scheduled", contactId: null },
];
const demoAutomationData: UiAutomation[] = [
  { id: "auto-1", name: "Relance prospect inactif", channel: "email", trigger: "Après 7 jours sans activité", active: true, ai: false, template: "Bonjour {{prenom}}, souhaitez-vous reprendre votre recherche immobilière ?" },
  { id: "auto-2", name: "Rappel de visite IA", channel: "sms", trigger: "24 h avant le rendez-vous", active: false, ai: true, template: "Bonjour {{prenom}}, rappel de votre visite demain. Répondez STOP pour vous désinscrire." },
];

const team = [
  { name: "Camille Moreau", role: "Directrice d'agence", initials: "CM", deals: "8 dossiers", amount: "2,8 M€" },
  { name: "Hugo Laurent", role: "Courtier senior", initials: "HL", deals: "6 dossiers", amount: "1,9 M€" },
  { name: "Nina Rey", role: "Courtière", initials: "NR", deals: "5 dossiers", amount: "1,4 M€" },
];

function App() {
  const [page, setPage] = useState<Page>("Aperçu");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [demoContactList, setDemoContactList] = useState<UiContact[]>(demoContacts);
  const [demoNoteList, setDemoNoteList] = useState<UiNote[]>(demoNotes);
  const [conversationContactId, setConversationContactId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [initialTaskContactId, setInitialTaskContactId] = useState<string>("");
  const [initialAppointmentContactId, setInitialAppointmentContactId] = useState<string>("");
  const [noteDraft, setNoteDraft] = useState("");
  const [demoPipelineState, setDemoPipelineState] = useState<PipelineColumn[]>(demoPipeline);
  const [demoTasks, setDemoTasks] = useState<UiTask[]>(demoTaskData);
  const [demoAppointments, setDemoAppointments] = useState<UiAppointment[]>(demoAppointmentData);
  const [demoAutomations, setDemoAutomations] = useState<UiAutomation[]>(demoAutomationData);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [billingYearly, setBillingYearly] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [toast, setToast] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const crm = useCrmData();
  const config = industryConfig[crm.industry] || industryConfig.immobilier;
  const dict = translations[crm.language] || translations.fr;
  const t = (key: string) => dict[key] || key;

  const today = useMemo(() => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), []);
  const activeContacts = useMemo<UiContact[]>(() => crm.session
    ? crm.contacts.map((contact) => ({
        id: contact.id,
        name: contact.full_name,
        role: contact.project,
        phone: contact.phone ?? "—",
        email: contact.email,
        status: contact.status,
        temperature: contact.temperature,
        initials: contact.initials,
        consentEmail: contact.consent_email,
        consentSms: contact.consent_sms,
        source: contact.source,
        budget: contact.budget,
        typePropriete: contact.type_propriete,
        secteur: contact.secteur,
        echeancier: contact.echeancier,
        preapprobation: contact.preapprobation,
        adresseTexte: contact.adresse_propriete,
        prixSouhaite: contact.prix_souhaite,
        qualificationResume: contact.qualification_resume,
        qualificationAction: contact.qualification_action,
        assignedTo: contact.assigned_to,
      }))
    : demoContactList, [crm.session, crm.contacts, demoContactList]);
  const activeDeletedContacts = useMemo<UiContact[]>(() => crm.session
    ? crm.deletedContacts.map((contact) => ({
        id: contact.id,
        name: contact.full_name,
        role: contact.project,
        phone: contact.phone ?? "—",
        email: contact.email,
        status: contact.status,
        temperature: contact.temperature,
        initials: contact.initials,
        consentEmail: contact.consent_email,
        consentSms: contact.consent_sms,
        source: contact.source,
      }))
    : [], [crm.session, crm.deletedContacts]);
  const activeNotes = useMemo<UiNote[]>(() => crm.session
    ? crm.contactNotes.map((note) => ({ id: note.id, contactId: note.contact_id, body: note.body, createdAt: note.created_at }))
    : demoNoteList, [crm.session, crm.contactNotes, demoNoteList]);
  const activeMessages = useMemo<UiMessage[]>(() => crm.session
    ? crm.messages.map((m) => ({ id: m.id, contactId: m.contact_id, direction: m.direction, body: m.body, createdAt: m.created_at }))
    : demoMessages, [crm.session, crm.messages]);
  const selectedContact = activeContacts.find((contact) => contact.id === selectedContactId) ?? null;
  const selectedContactNotes = useMemo(
    () => activeNotes.filter((note) => note.contactId === selectedContactId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activeNotes, selectedContactId]
  );
  const activePipeline = useMemo<PipelineColumn[]>(() => {
    if (!crm.session) return demoPipelineState;
    return demoPipeline.map((stage) => {
      const deals = crm.transactions
        .filter((transaction) => transaction.stage === stage.label)
        .map((transaction) => ({
          id: transaction.id,
          name: transaction.contact_name,
          property: [transaction.property_name, transaction.property_location].filter(Boolean).join(" · "),
          value: new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(transaction.amount),
          amount: Number(transaction.amount),
          initials: transaction.initials,
          tone: transaction.tone,
          days: transaction.last_activity ?? undefined,
        }));
      const amount = crm.transactions
        .filter((transaction) => transaction.stage === stage.label)
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
      return {
        ...stage,
        deals,
        value: new Intl.NumberFormat("fr-CA", { notation: "compact", style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(amount),
      };
    });
  }, [crm.session, crm.transactions, demoPipelineState]);
  const totalPipeline = activePipeline.flatMap((stage) => stage.deals).reduce((sum, deal) => sum + deal.amount, 0);
  const transactionCount = activePipeline.flatMap((stage) => stage.deals).length;
  const activeTasks: UiTask[] = crm.session ? crm.tasks.map((task) => ({ id: task.id, title: task.title, description: task.description, dueAt: task.due_at, priority: task.priority, done: task.status === "done", contactId: task.contact_id })) : demoTasks;
  const activeAppointments: UiAppointment[] = crm.session ? crm.appointments.map((item) => ({ id: item.id, title: item.title, startAt: item.start_at, endAt: item.end_at, location: item.location, status: item.status, contactId: item.contact_id })) : demoAppointments;
  const activeAutomations: UiAutomation[] = crm.session ? crm.automationRules.map((rule) => ({ id: rule.id, name: rule.name, channel: rule.channel, trigger: rule.trigger_type === "inactivity" ? `Après ${Math.round(rule.delay_minutes / 1440)} jour${Math.round(rule.delay_minutes / 1440) > 1 ? "s" : ""} sans activité` : rule.trigger_type, active: rule.active, ai: rule.ai_enabled, template: rule.template })) : demoAutomations;

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const choosePage = (label: Page) => {
    setPage(label);
    setMenuOpen(false);
  };

  return (
    <div className="app-shell">
      {menuOpen && <button className="mobile-overlay" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Home size={18} strokeWidth={2.2} /></div>
          <span>Closia</span>
          <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Fermer"><X size={20} /></button>
        </div>
        <div className="workspace-pill">
          <div className="workspace-avatar">{(crm.session && crm.agencyName ? crm.agencyName : "Atelier Moreau").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}</div>
          <div><strong>{crm.session && crm.agencyName ? crm.agencyName : "Atelier Moreau"}</strong><span>{{ immobilier: "Agence immobilière", sante: "Clinique / Cabinet", esthetique: "Institut de beauté", conciergerie: "Service de conciergerie" }[crm.industry] || "Agence"}</span></div>
          <ChevronDown size={15} />
        </div>
        <nav>
          <p className="nav-label">Espace de travail</p>
          {navigation.map((item) => (
            <button key={item.label} onClick={() => choosePage(item.label)} className={page === item.label ? "active" : ""}>
              <item.icon size={18} strokeWidth={1.8} />
              <span>{item.label === "Propriétés" ? config.propertiesLabel : t(item.label)}</span>
              {item.count && <b>{item.count}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => crm.session ? void crm.signOut() : setAuthModalOpen(true)}>{crm.session ? <LogOut size={18} /> : <ContactRound size={18} />}<span>{crm.session ? "Déconnexion" : "Connexion"}</span></button>
          <div className="profile">
            <div className="profile-avatar">{(crm.session?.user.user_metadata.full_name ?? "Camille Moreau").split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join("")}</div>
            <div><strong>{crm.session?.user.user_metadata.full_name ?? "Camille Moreau"}</strong><span>{crm.session ? "Compte connecté" : "Mode démonstration"}</span></div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main>
        <header>
          <button className="menu-button" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <button className="search-box" onClick={() => setSearchOpen(true)}>
            <Search size={17} /><span>Rechercher un contact, un bien…</span><kbd><Command size={12} /> K</kbd>
          </button>
          <div className="header-actions">
            <button className="icon-button notification" onClick={() => announce("Vous n’avez aucune nouvelle notification")}><Bell size={19} /><i /></button>
            <button className="add-button" onClick={() => setModalOpen(true)}><Plus size={18} /><span>Nouveau contact</span></button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{today}</p>
              <h1>{page === "Aperçu" ? <>Bonjour {(crm.session?.user.user_metadata.full_name ?? "Camille Moreau").split(" ")[0]}, <em>prêt(e) à conclure ?</em></> : page}</h1>
              <p>{page === "Aperçu" ? "Voici ce qui mérite votre attention aujourd’hui." : page === "Studio vidéo" ? "Filmez, l’IA monte : sous-titres professionnels, silences coupés, musique et carton de fin. Publiez en Reel en un clic." : page === "Contenu" ? "Chaque matin, une idée de publication prête pour Instagram et Facebook. Vous validez, c’est publié." : `Gérez vos ${page.toLowerCase()} depuis un seul espace.`}</p>
            </div>
            {page !== "Aperçu" && page !== "Contenu" && page !== "Studio vidéo" && <button className="outline-action" onClick={() => page === "Pipeline" ? setDealModalOpen(true) : setModalOpen(true)}><Plus size={17} /> Ajouter</button>}
          </div>

          {crm.configured && !crm.session && (
            <section className="connection-banner">
              <div><strong>La démo est prête — connectez-vous pour sauvegarder</strong><span>Utilisez maintenant un e-mail et un mot de passe. Aucun lien magique n’est nécessaire.</span></div>
              <button onClick={() => setAuthModalOpen(true)}>Se connecter <ArrowRight size={15} /></button>
            </section>
          )}
          {(!crm.configured || !crm.session) && <section className="demo-notice"><span>Mode démonstration</span> Explorez librement le CRM. Les données affichées sont des exemples.</section>}
          {crm.error && <section className="data-error">Connexion Supabase : {crm.error}</section>}
          {crm.loading && <section className="data-loading">Synchronisation sécurisée des données…</section>}
          {page === "Aperçu" && <Dashboard pipeline={activePipeline} totalPipeline={totalPipeline} transactionCount={transactionCount} contacts={activeContacts} tasks={activeTasks} appointments={activeAppointments} config={config} onNavigate={choosePage} onAnnounce={announce} completed={completed} setCompleted={setCompleted} />}
          {page === "Pipeline" && <PipelineView pipeline={activePipeline} onAdd={() => setDealModalOpen(true)} onMove={async (dealId, currentStage, nextStage) => {
            if (!nextStage || nextStage === currentStage) return;
            try {
              if (crm.session) await crm.updateTransactionStage(dealId, nextStage);
              else setDemoPipelineState((current) => {
                const movingDeal = current.flatMap((stage) => stage.deals).find((deal) => deal.id === dealId);
                if (!movingDeal) return current;
                return current.map((stage) => ({ ...stage, deals: stage.label === currentStage ? stage.deals.filter((deal) => deal.id !== dealId) : stage.label === nextStage ? [{ ...movingDeal, days: "À l’instant" }, ...stage.deals] : stage.deals }));
              });
              announce(`Transaction déplacée vers ${nextStage}`);
            } catch (error) { announce(error instanceof Error ? error.message : "Déplacement impossible"); }
          }} />}
          {page === "Contacts" && <ContactsView contacts={activeContacts} deletedContacts={activeDeletedContacts} onOpen={(id) => setSelectedContactId(id)} onDelete={async (id) => {
            try {
              if (crm.session) await crm.softDeleteContact(id);
              else setDemoContactList((current) => current.filter((c) => c.id !== id));
              announce("Contact déplacé vers la corbeille");
            } catch (error) { announce(error instanceof Error ? error.message : "Suppression impossible"); }
          }} onRestore={async (id) => {
            try { if (crm.session) await crm.restoreContact(id); announce("Contact restauré"); } catch (error) { announce(error instanceof Error ? error.message : "Restauration impossible"); }
          }} onDeleteForever={async (id) => {
            try { if (crm.session) await crm.permanentlyDeleteContact(id); announce("Contact supprimé définitivement"); } catch (error) { announce(error instanceof Error ? error.message : "Suppression impossible"); }
          }} onEmptyTrash={async () => {
            try { if (crm.session) await crm.emptyContactsTrash(); announce("Corbeille vidée"); } catch (error) { announce(error instanceof Error ? error.message : "Suppression impossible"); }
          }} onStatus={async (id, status) => {
            try {
              if (crm.session) await crm.updateContactStatus(id, status);
              else setDemoContactList((current) => current.map((contact) => contact.id === id ? { ...contact, status } : contact));
              announce("Statut du contact mis à jour");
            } catch (error) { announce(error instanceof Error ? error.message : "Mise à jour impossible"); }
          }} onConsent={async (id, channel, value) => {
            try {
              if (crm.session) await crm.updateContactConsent(id, channel, value);
              else setDemoContactList((current) => current.map((contact) => contact.id === id ? { ...contact, [channel === "email" ? "consentEmail" : "consentSms"]: value } : contact));
              announce(`Consentement ${channel.toUpperCase()} mis à jour`);
            } catch (error) { announce(error instanceof Error ? error.message : "Mise à jour impossible"); }
          }} />}
          {page === "Conversations SMS" && <ConversationsView contacts={activeContacts} messages={activeMessages} selectedId={conversationContactId} onSelect={setConversationContactId} />}
          {page === "Propriétés" && <PropertiesView properties={crm.session ? crm.properties : []} contacts={activeContacts} onCreate={async (input) => {
            try { if (crm.session) await crm.addProperty(input); announce(input.international?.publier ? "Propriété ajoutée et publiée sur le site" : "Propriété ajoutée"); } catch (error) { announce(error instanceof Error ? error.message : "Ajout impossible"); }
          }} onUpdate={async (id, input) => {
            try { if (crm.session) await crm.updateProperty(id, input); announce("Propriété mise à jour"); } catch (error) { announce(error instanceof Error ? error.message : "Mise à jour impossible"); }
          }} onStatusChange={async (id, status) => {
            try { if (crm.session) await crm.updatePropertyStatus(id, status); announce("Statut mis à jour"); } catch (error) { announce(error instanceof Error ? error.message : "Mise à jour impossible"); }
          }} onDelete={async (id) => {
            try { if (crm.session) await crm.deleteProperty(id); announce("Propriété supprimée"); } catch (error) { announce(error instanceof Error ? error.message : "Suppression impossible"); }
          }} />}
          {page === "Tâches" && <TasksWorkspace tasks={activeTasks} appointments={activeAppointments} contacts={activeContacts} onAddTask={() => { setInitialTaskContactId(""); setTaskModalOpen(true); }} onAddAppointment={() => { setInitialAppointmentContactId(""); setAppointmentModalOpen(true); }} onToggle={async (id, done) => { if (crm.session) await crm.toggleTask(id, done); else setDemoTasks((current) => current.map((task) => task.id === id ? { ...task, done } : task)); }} onDelete={async (id) => { if (crm.session) await crm.deleteTask(id); else setDemoTasks((current) => current.filter((task) => task.id !== id)); }} onDeleteAppointment={async (id) => { try { if (crm.session) await crm.deleteAppointment(id); else setDemoAppointments((current) => current.filter((item) => item.id !== id)); announce("Rendez-vous supprimé"); } catch (error) { announce(error instanceof Error ? error.message : "Suppression impossible"); } }} />}
          {page === "Automatisations" && <AutomationsView rules={activeAutomations} logs={crm.messageLogs} onToggle={async (id, active) => { if (crm.session) await crm.toggleAutomationRule(id, active); else setDemoAutomations((current) => current.map((rule) => rule.id === id ? { ...rule, active } : rule)); }} onCreate={async (input) => {
            try {
              if (crm.session) await crm.addAutomationRule(input);
              else setDemoAutomations((current) => [...current, { id: `auto-${Date.now()}`, name: input.name, channel: input.channel as "email" | "sms", trigger: `Après ${input.delayDays} jours sans activité`, active: true, ai: false, template: input.template }]);
              announce("Automatisation créée");
            } catch (error) { announce(error instanceof Error ? error.message : "Création impossible"); }
          }} onDelete={async (id) => {
            try {
              if (crm.session) await crm.deleteAutomationRule(id);
              else setDemoAutomations((current) => current.filter((rule) => rule.id !== id));
              announce("Automatisation supprimée");
            } catch (error) { announce(error instanceof Error ? error.message : "Suppression impossible"); }
          }} />}
          {page === "Équipe" && <TeamView members={crm.session ? crm.teamMembers : []} organizationId={crm.session ? crm.organizationId : null} onAnnounce={announce} onRemove={async (id) => { try { await crm.removeTeamMember(id); announce("Membre retiré de l’équipe"); } catch (error) { announce(error instanceof Error ? error.message : "Action impossible"); } }} onRestore={async (id) => { try { await crm.restoreTeamMember(id); announce("Membre restauré"); } catch (error) { announce(error instanceof Error ? error.message : "Action impossible"); } }} onDeleteForever={async (id) => { try { await crm.deleteTeamMemberForever(id); announce("Membre supprimé définitivement"); } catch (error) { announce(error instanceof Error ? error.message : "Action impossible"); } }} onEmptyTrash={async () => { try { await crm.emptyTeamTrash(); announce("Corbeille de l’équipe vidée"); } catch (error) { announce(error instanceof Error ? error.message : "Action impossible"); } }} />}
          {page === "Studio vidéo" && <VideoStudio connected={Boolean(crm.session)} announce={announce} />}
          {page === "Contenu" && <ContentView connected={Boolean(crm.session)} announce={announce} />}
          {page === "Paramètres" && <SettingsView industry={crm.industry} canChangePassword={Boolean(crm.session)} onChangePassword={async (pw) => { await crm.updatePassword(pw); announce("Mot de passe modifié"); }} />}
          {page === "Forfaits" && <PricingView yearly={billingYearly} setYearly={setBillingYearly} currentPlan={crm.subscription?.plan ?? "trial"} onChoose={async (plan) => { try { if (!crm.session) return announce("Connectez-vous avant de choisir un forfait"); await crm.createCheckout(plan, billingYearly ? "yearly" : "monthly"); } catch (error) { announce(error instanceof Error ? error.message : "Stripe n’est pas configuré"); } }} />}
        </div>
      </main>

      {searchOpen && (
        <div className="modal-layer" onMouseDown={(e) => e.target === e.currentTarget && setSearchOpen(false)}>
          <div className="command-panel">
            <div className="command-input"><Search size={20} /><input autoFocus placeholder="Rechercher dans Closia…" /><button onClick={() => setSearchOpen(false)}>Échap</button></div>
            <p>RECHERCHES RÉCENTES</p>
            {["Claire Bernard", "Villa des Monts", "Dossiers à relancer"].map((item) => <button className="recent-item" key={item}><Clock3 size={16} />{item}<ArrowRight size={15} /></button>)}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-layer" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <form className="contact-modal" onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            try {
              const contactInput = {
                fullName: String(form.get("fullName")),
                email: String(form.get("email")),
                phone: String(form.get("phone")),
                project: String(form.get("project")),
              };
              if (crm.session) await crm.addContact(contactInput);
              else {
                const initials = contactInput.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
                setDemoContactList((current) => [{ id: `demo-${Date.now()}`, name: contactInput.fullName, email: contactInput.email, phone: contactInput.phone || "—", role: contactInput.project, status: "Nouveau", temperature: null, initials }, ...current]);
              }
              setModalOpen(false);
              announce(crm.session ? "Le nouveau contact a bien été enregistré" : "Contact ajouté à la démonstration");
            } catch (error) {
              announce(error instanceof Error ? error.message : "Impossible d’ajouter ce contact");
            }
          }}>
            <div className="modal-title"><div><span>Nouveau dossier</span><h2>Ajouter un contact</h2></div><button type="button" onClick={() => setModalOpen(false)}><X size={20} /></button></div>
            <label>Nom complet<input name="fullName" required placeholder="Ex. Jeanne Lefèvre" /></label>
            <div className="form-grid"><label>Adresse e-mail<input name="email" required type="email" placeholder="nom@email.fr" /></label><label>Téléphone<input name="phone" placeholder="06 00 00 00 00" /></label></div>
            <label>Projet<select name="project" required defaultValue="">{config.projectOptions.map((opt) => <option key={opt}>{opt}</option>)}</select></label>
            <div className="modal-actions"><button type="button" onClick={() => setModalOpen(false)}>Annuler</button><button type="submit">Créer le contact <ArrowRight size={16} /></button></div>
          </form>
        </div>
      )}
      {crm.passwordRecovery && crm.session && (
        <div className="modal-layer">
          <div className="contact-modal auth-modal">
            <div className="modal-title"><div><span>Espace sécurisé</span><h2>Choisir un nouveau mot de passe</h2></div></div>
            <p className="settings-note-plain">Vous avez demandé à réinitialiser votre mot de passe. Choisissez-en un nouveau pour terminer.</p>
            <PasswordForm submitLabel="Enregistrer le mot de passe" onCancel={crm.dismissPasswordRecovery} onSubmit={async (pw) => { await crm.updatePassword(pw); announce("Mot de passe modifié"); }} />
          </div>
        </div>
      )}
      {authModalOpen && (
        <div className="modal-layer" onMouseDown={(event) => event.target === event.currentTarget && setAuthModalOpen(false)}>
          <form className="contact-modal auth-modal" onSubmit={async (event) => {
            event.preventDefault(); setAuthLoading(true); setAuthMessage("");
            const form = new FormData(event.currentTarget);
            try {
              if (authMode === "signin") await crm.signInWithPassword(String(form.get("email")), String(form.get("password")));
              else await crm.signUpWithPassword(String(form.get("email")), String(form.get("password")), String(form.get("fullName")), String(form.get("agencyName")), String(form.get("industry") || "immobilier"), String(form.get("joinCode") || ""));
              setAuthMessage(authMode === "signin" ? "Connexion réussie." : "Compte créé. Vérifiez votre e-mail si une confirmation est demandée.");
              if (authMode === "signin") setAuthModalOpen(false);
            } catch (error) { setAuthMessage(error instanceof Error ? error.message : "Authentification impossible"); }
            finally { setAuthLoading(false); }
          }}>
            <div className="modal-title"><div><span>Espace sécurisé</span><h2>{authMode === "signin" ? "Connexion à Closia" : "Créer votre agence"}</h2></div><button type="button" onClick={() => setAuthModalOpen(false)}><X size={20} /></button></div>
            <div className="auth-tabs"><button type="button" className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Connexion</button><button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>Créer un compte</button></div>
            {authMode === "signup" && <div className="form-grid"><label>Votre nom<input name="fullName" required placeholder="Camille Moreau" /></label><label>Code d’agence (si vous rejoignez une équipe)<input name="joinCode" placeholder="Laissez vide pour créer votre propre agence" /></label><label>Nom de l’agence<input name="agencyName" placeholder="Atelier Moreau" /></label><label>Secteur d’activité<select name="industry" defaultValue="immobilier"><option value="immobilier">Immobilier</option><option value="sante">Santé</option><option value="esthetique">Esthétique</option><option value="conciergerie">Conciergerie</option></select></label></div>}
            <label>Adresse e-mail<input name="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required type="email" placeholder="vous@agence.fr" /></label>
            <label>Mot de passe<input name="password" required type="password" minLength={8} placeholder="8 caractères minimum" /></label>
            {authMessage && <p className="auth-message">{authMessage}</p>}
            <div className="modal-actions"><button type="button" onClick={async () => { if (!authEmail) return setAuthMessage("Saisissez d’abord votre e-mail."); try { await crm.resetPassword(authEmail); setAuthMessage("E-mail de réinitialisation envoyé."); } catch (error) { setAuthMessage(error instanceof Error ? error.message : "Envoi impossible"); } }}>Mot de passe oublié</button><button disabled={authLoading} type="submit">{authLoading ? "Patientez…" : authMode === "signin" ? "Se connecter" : "Créer mon compte"} <ArrowRight size={16} /></button></div>
          </form>
        </div>
      )}
      {taskModalOpen && (
        <div className="modal-layer"><form className="contact-modal" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const contactId = String(form.get("contactId") || "") || null; const input = { title: String(form.get("title")), description: String(form.get("description")), priority: String(form.get("priority")) as UiTask["priority"], dueAt: String(form.get("dueAt")), contactId }; try { if (crm.session) await crm.addTask(input); else setDemoTasks((current) => [...current, { id: `task-${Date.now()}`, ...input, done: false }]); setTaskModalOpen(false); announce("Tâche ajoutée"); } catch (error) { announce(error instanceof Error ? error.message : "Ajout impossible"); } }}><div className="modal-title"><div><span>Organisation</span><h2>Nouvelle tâche</h2></div><button type="button" onClick={() => setTaskModalOpen(false)}><X size={20} /></button></div><label>Titre<input name="title" required placeholder="Rappeler le prospect" /></label><label>Description<input name="description" placeholder="Notes et contexte" /></label>{activeContacts.length > 0 && <label>Lead concerné (optionnel)<select name="contactId" defaultValue={initialTaskContactId}><option value="">Aucun lead spécifique</option>{activeContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>}<div className="form-grid"><label>Échéance<input name="dueAt" required type="datetime-local" /></label><label>Priorité<select name="priority" defaultValue="normal"><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></label></div><div className="modal-actions"><button type="button" onClick={() => setTaskModalOpen(false)}>Annuler</button><button type="submit">Ajouter <ArrowRight size={16} /></button></div></form></div>
      )}
      {appointmentModalOpen && (
        <div className="modal-layer"><form className="contact-modal" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const contactId = String(form.get("contactId") || "") || null; const input = { title: String(form.get("title")), startAt: String(form.get("startAt")), endAt: String(form.get("endAt")), location: String(form.get("location")), notes: String(form.get("notes")), contactId }; try { if (crm.session) await crm.addAppointment(input); else setDemoAppointments((current) => [...current, { id: `appointment-${Date.now()}`, ...input, status: "scheduled" }]); setAppointmentModalOpen(false); announce("Rendez-vous ajouté"); } catch (error) { announce(error instanceof Error ? error.message : "Ajout impossible"); } }}><div className="modal-title"><div><span>Agenda</span><h2>Nouveau rendez-vous</h2></div><button type="button" onClick={() => setAppointmentModalOpen(false)}><X size={20} /></button></div><label>Titre<input name="title" required placeholder="Visite avec le client" /></label>{activeContacts.length > 0 && <label>Lead concerné (optionnel)<select name="contactId" defaultValue={initialAppointmentContactId}><option value="">Aucun lead spécifique</option>{activeContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>}<div className="form-grid"><label>Début<input name="startAt" required type="datetime-local" /></label><label>Fin<input name="endAt" required type="datetime-local" /></label></div><label>Lieu<input name="location" placeholder="Adresse ou visioconférence" /></label><label>Notes<input name="notes" placeholder="Informations utiles" /></label><div className="modal-actions"><button type="button" onClick={() => setAppointmentModalOpen(false)}>Annuler</button><button type="submit">Planifier <ArrowRight size={16} /></button></div></form></div>
      )}
      {dealModalOpen && (
        <div className="modal-layer" onMouseDown={(event) => event.target === event.currentTarget && setDealModalOpen(false)}>
          <form className="contact-modal" onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const contactId = String(form.get("contactId") || "");
            const selectedContact = activeContacts.find((contact) => contact.id === contactId);
            const input = {
              contactId: crm.session && contactId ? contactId : null,
              contactName: selectedContact?.name ?? String(form.get("contactName")),
              propertyName: String(form.get("propertyName")),
              propertyLocation: String(form.get("propertyLocation")),
              stage: String(form.get("stage")),
              amount: Number(form.get("amount")),
            };
            try {
              if (crm.session) await crm.addTransaction(input);
              else {
                const initials = input.contactName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
                const deal: Deal = { id: `deal-${Date.now()}`, name: input.contactName, property: [input.propertyName, input.propertyLocation].filter(Boolean).join(" · "), value: new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(input.amount), amount: input.amount, initials, tone: "sand", days: "À l’instant" };
                setDemoPipelineState((current) => current.map((stage) => stage.label === input.stage ? { ...stage, deals: [deal, ...stage.deals] } : stage));
              }
              setDealModalOpen(false);
              announce(crm.session ? "Transaction enregistrée" : "Transaction ajoutée à la démonstration");
            } catch (error) { announce(error instanceof Error ? error.message : "Création impossible"); }
          }}>
            <div className="modal-title"><div><span>Nouvelle opportunité</span><h2>Créer une transaction</h2></div><button type="button" onClick={() => setDealModalOpen(false)}><X size={20} /></button></div>
            {activeContacts.length > 0 ? <label>Contact<select name="contactId" required defaultValue=""><option value="" disabled>Sélectionner un contact</option>{activeContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label> : <label>Nom du contact<input name="contactName" required placeholder="Ex. Jeanne Lefèvre" /></label>}
            <div className="form-grid"><label>Bien<input name="propertyName" required placeholder="Ex. Appartement T3" /></label><label>Localisation<input name="propertyLocation" required placeholder="Ex. Lyon 6e" /></label></div>
            <div className="form-grid"><label>Montant estimé<input name="amount" required min="0" step="1000" type="number" placeholder="450000" /></label><label>Étape<select name="stage" defaultValue="Nouveaux prospects">{demoPipeline.map((stage) => <option key={stage.label}>{stage.label}</option>)}</select></label></div>
            <div className="modal-actions"><button type="button" onClick={() => setDealModalOpen(false)}>Annuler</button><button type="submit">Créer la transaction <ArrowRight size={16} /></button></div>
          </form>
        </div>
      )}
      {selectedContact && (
        <div className="modal-layer" onMouseDown={(e) => e.target === e.currentTarget && setSelectedContactId(null)}>
          <div className="contact-modal contact-detail">
            <div className="modal-title">
              <div><span>Fiche contact</span><h2>{selectedContact.name}</h2></div>
              <button type="button" onClick={() => setSelectedContactId(null)}><X size={20} /></button>
            </div>

            <div className="contact-detail__meta">
              <span><Mail size={13} /> {selectedContact.email}</span>
              <span><MessageSquareText size={13} /> {selectedContact.phone}</span>
              <span>{selectedContact.role}</span>
              {selectedContact.source && <span><Target size={13} /> {selectedContact.source}</span>}
            </div>

            <div className="contact-detail__quick-actions">
              <a href={`tel:${selectedContact.phone}`}><Phone size={14} /> Appeler</a>
              <a href={`sms:${selectedContact.phone}`}><MessageSquareText size={14} /> SMS</a>
              <a href={`mailto:${selectedContact.email}`}><Mail size={14} /> Courriel</a>
              <button type="button" onClick={() => { setInitialTaskContactId(selectedContact.id); setTaskModalOpen(true); }}><Plus size={14} /> Tâche</button>
              <button type="button" onClick={() => { setInitialAppointmentContactId(selectedContact.id); setAppointmentModalOpen(true); }}><CalendarDays size={14} /> Rendez-vous</button>
            </div>

            <div className={`qualification-box ${selectedContact.temperature === "Chaud" ? "qualified" : selectedContact.temperature === "Tiède" ? "pending" : selectedContact.temperature === "Froid" ? "unqualified" : "unknown"}`}>
              <span className="qualification-box__badge">
                {selectedContact.temperature === "Chaud" && "🟢 Lead qualifié"}
                {selectedContact.temperature === "Tiède" && "🟡 À qualifier"}
                {selectedContact.temperature === "Froid" && "🔴 Non qualifié"}
                {!selectedContact.temperature && "⚪ Non évalué"}
              </span>
              {selectedContact.qualificationResume && <p>{selectedContact.qualificationResume}</p>}
              {selectedContact.qualificationAction && <p className="qualification-box__action"><b>Action suggérée :</b> {selectedContact.qualificationAction}</p>}
            </div>

            {(selectedContact.budget || selectedContact.secteur || selectedContact.typePropriete || selectedContact.echeancier || selectedContact.preapprobation || selectedContact.adresseTexte || selectedContact.prixSouhaite) && (
              <div className="profile-grid">
                {selectedContact.budget && <div><span>Budget</span><b>{selectedContact.budget}</b></div>}
                {selectedContact.typePropriete && <div><span>Type de propriété</span><b>{selectedContact.typePropriete}</b></div>}
                {selectedContact.secteur && <div><span>Secteur recherché</span><b>{selectedContact.secteur}</b></div>}
                {selectedContact.adresseTexte && <div><span>Adresse de la propriété</span><b>{selectedContact.adresseTexte}</b></div>}
                {selectedContact.prixSouhaite && <div><span>Prix souhaité</span><b>{selectedContact.prixSouhaite}</b></div>}
                {selectedContact.echeancier && <div><span>Échéancier</span><b>{selectedContact.echeancier}</b></div>}
                {selectedContact.preapprobation && <div><span>Préapprobation</span><b>{selectedContact.preapprobation}</b></div>}
              </div>
            )}

            <div className="contact-detail__row">
              <label>
                <span><Thermometer size={13} /> Température du lead</span>
                <select
                  className="temperature-select"
                  value={selectedContact.temperature ?? ""}
                  onChange={async (event) => {
                    const value = (event.target.value || null) as UiContact["temperature"];
                    try {
                      if (crm.session) await crm.updateContactTemperature(selectedContact.id, value);
                      else setDemoContactList((current) => current.map((contact) => contact.id === selectedContact.id ? { ...contact, temperature: value } : contact));
                      announce("Température mise à jour");
                    } catch (error) { announce(error instanceof Error ? error.message : "Mise à jour impossible"); }
                  }}
                >
                  <option value="">Non évalué</option>
                  <option value="Chaud">🔥 Chaud</option>
                  <option value="Tiède">🌤️ Tiède</option>
                  <option value="Froid">❄️ Froid</option>
                </select>
              </label>
              <label>
                <span>Statut du dossier</span>
                <select
                  className="status-select"
                  value={selectedContact.status}
                  onChange={async (event) => {
                    const status = event.target.value;
                    try {
                      if (crm.session) await crm.updateContactStatus(selectedContact.id, status);
                      else setDemoContactList((current) => current.map((contact) => contact.id === selectedContact.id ? { ...contact, status } : contact));
                      announce("Statut du contact mis à jour");
                    } catch (error) { announce(error instanceof Error ? error.message : "Mise à jour impossible"); }
                  }}
                >
                  <option>Nouveau</option>
                  <option>À relancer</option>
                  <option>Visite</option>
                  <option>Offre déposée</option>
                  <option>Signature</option>
                  <option>Gagné</option>
                  <option>Perdu</option>
                </select>
              </label>
              {crm.teamMembers.filter((m) => m.active).length > 1 && (
                <label>
                  <span><UserMinus size={13} style={{ transform: "scaleX(-1)" }} /> Assigné à</span>
                  <select
                    className="status-select"
                    value={selectedContact.assignedTo ?? ""}
                    onChange={async (event) => {
                      const memberId = event.target.value || null;
                      try {
                        await crm.assignContact(selectedContact.id, memberId);
                        announce("Lead assigné");
                      } catch (error) { announce(error instanceof Error ? error.message : "Assignation impossible"); }
                    }}
                  >
                    <option value="">Moi (non assigné)</option>
                    {crm.teamMembers.filter((m) => m.active && m.role !== "owner").map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </label>
              )}
            </div>

            <div className="contact-detail__notes">
              <div className="contact-detail__notes-title"><StickyNote size={15} /> Notes de suivi</div>
              <form
                className="note-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const body = noteDraft.trim();
                  if (!body) return;
                  try {
                    if (crm.session) await crm.addContactNote(selectedContact.id, body);
                    else setDemoNoteList((current) => [{ id: `note-${Date.now()}`, contactId: selectedContact.id, body, createdAt: new Date().toISOString() }, ...current]);
                    setNoteDraft("");
                    announce("Note ajoutée");
                  } catch (error) { announce(error instanceof Error ? error.message : "Ajout impossible"); }
                }}
              >
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Ex. Rappelé le client, toujours intéressé, rappel prévu vendredi..."
                  rows={3}
                />
                <button type="submit"><Plus size={15} /> Ajouter la note</button>
              </form>

              <div className="note-list">
                {selectedContactNotes.length === 0 && <div className="empty-state"><StickyNote size={22} /><b>Aucune note pour l’instant</b><span>Ajoutez un suivi après chaque appel ou visite.</span></div>}
                {selectedContactNotes.map((note) => (
                  <article className="note-card" key={note.id}>
                    <p>{note.body}</p>
                    <footer>
                      <time>{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(note.createdAt))}</time>
                      <button type="button" onClick={async () => {
                        try {
                          if (crm.session) await crm.deleteContactNote(note.id);
                          else setDemoNoteList((current) => current.filter((n) => n.id !== note.id));
                        } catch (error) { announce(error instanceof Error ? error.message : "Suppression impossible"); }
                      }}><Trash2 size={13} /></button>
                    </footer>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

function Dashboard({ pipeline, totalPipeline, transactionCount, contacts, tasks, appointments, config, onNavigate, onAnnounce, completed, setCompleted }: { pipeline: PipelineColumn[]; totalPipeline: number; transactionCount: number; contacts: UiContact[]; tasks: UiTask[]; appointments: UiAppointment[]; config: { roleA: string; roleB: string; projectOptions: string[]; propertiesLabel: string; contactWord: string }; onNavigate: (p: Page) => void; onAnnounce: (s: string) => void; completed: number[]; setCompleted: (v: number[]) => void }) {
  const formattedTotal = new Intl.NumberFormat("fr-CA", { notation: "compact", style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(totalPipeline);
  const nouveauxLeads = contacts.filter((c) => c.status === "Nouveau").length;
  const acheteurs = contacts.filter((c) => c.role === config.projectOptions[0]).length;
  const vendeurs = contacts.filter((c) => c.role === config.projectOptions[1] || c.role === config.projectOptions[2]).length;
  const qualifies = contacts.filter((c) => c.temperature === "Chaud" || c.temperature === "Tiède").length;
  const rdvAVenir = appointments.filter((a) => new Date(a.startAt).getTime() >= Date.now()).length;
  const gagnes = contacts.filter((c) => c.status === "Gagné").length;
  const tauxConversion = contacts.length > 0 ? Math.round((gagnes / contacts.length) * 100) : 0;

  return <>
    <section className="kpi-grid">
      <article className="kpi-card">
        <div className="kpi-top"><span>Nouveaux leads</span><div className="kpi-icon blue"><UsersRound size={16} /></div></div>
        <strong>{nouveauxLeads}</strong>
        <p className="kpi-trend up">sur {contacts.length} contacts au total</p>
      </article>
      <article className="kpi-card">
        <div className="kpi-top"><span>{config.roleA}</span><div className="kpi-icon blue"><Home size={16} /></div></div>
        <strong>{acheteurs}</strong>
        <p>dossiers actifs</p>
      </article>
      <article className="kpi-card">
        <div className="kpi-top"><span>{config.roleB}</span><div className="kpi-icon blue"><Building2 size={16} /></div></div>
        <strong>{vendeurs}</strong>
        <p>dossiers actifs</p>
      </article>
      <article className="kpi-card">
        <div className="kpi-top"><span>Leads qualifiés</span><div className="kpi-icon success"><Sparkles size={16} /></div></div>
        <strong>{qualifies}</strong>
        <p className="kpi-trend up">chauds ou tièdes</p>
      </article>
      <article className="kpi-card">
        <div className="kpi-top"><span>Rendez-vous</span><div className="kpi-icon warning"><CalendarDays size={16} /></div></div>
        <strong>{rdvAVenir}</strong>
        <p>à venir</p>
      </article>
      <article className="kpi-card">
        <div className="kpi-top"><span>Taux de conversion</span><div className="kpi-icon blue"><TrendingUp size={16} /></div></div>
        <strong>{tauxConversion}%</strong>
        <p>{gagnes} dossier{gagnes > 1 ? "s" : ""} gagné{gagnes > 1 ? "s" : ""}</p>
      </article>
    </section>

    <div className="dashboard-grid">
      <section className="panel pipeline-panel">
        <div className="panel-heading"><div><h2>Pipeline commercial</h2><p>{transactionCount} transactions · {formattedTotal}</p></div><button onClick={() => onNavigate("Pipeline")}>Voir le pipeline <ArrowRight size={15} /></button></div>
        <div className="pipeline-summary">
          {pipeline.map((column) => <div className="pipeline-stage" key={column.label} style={{ "--stage": column.color } as React.CSSProperties}><span>{column.label}</span><strong>{column.deals.length}</strong><i /></div>)}
        </div>
        <div className="recent-deals">
          <div className="table-head"><span>CONTACT</span><span>ÉTAPE</span><span>VALEUR</span><span>ACTIVITÉ</span></div>
          {pipeline.flatMap((x) => x.deals.map((d) => ({ ...d, stage: x.label, color: x.color }))).slice(0, 4).map((deal) => (
            <button className="deal-row" key={deal.name} onClick={() => onAnnounce(`Dossier de ${deal.name} ouvert`)}>
              <span className={`avatar ${deal.tone}`}>{deal.initials}</span><span className="deal-name"><b>{deal.name}</b><small>{deal.property}</small></span><span className="stage-tag"><i style={{ background: deal.color }} />{deal.stage}</span><strong>{deal.value}</strong><small>{deal.days}</small>
            </button>
          ))}
        </div>
      </section>

      <aside className="panel today-panel">
        <div className="panel-heading"><div><h2>Aujourd’hui</h2><p>{tasks.length} action{tasks.length > 1 ? "s" : ""} planifiée{tasks.length > 1 ? "s" : ""}</p></div><button className="round-plus" onClick={() => onNavigate("Tâches")}><Plus size={18} /></button></div>
        <div className="task-list">
          {tasks.length === 0 && <div className="empty-state"><CalendarDays size={22} /><b>Rien de planifié</b><span>Ajoutez une tâche pour aujourd’hui.</span></div>}
          {tasks.slice(0, 6).map((task, i) => <button className={`task ${completed.includes(i) ? "done" : ""}`} key={task.id}><span className="task-check" onClick={(e) => { e.stopPropagation(); setCompleted(completed.includes(i) ? completed.filter(x => x !== i) : [...completed, i]); }}>{completed.includes(i) && <Check size={13} />}</span><span><b>{task.title}</b><small>{task.description}</small></span><time>{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(task.dueAt))}</time></button>)}
        </div>
        <button className="day-link" onClick={() => onNavigate("Tâches")}>Voir toute la journée <ArrowRight size={15} /></button>
      </aside>
    </div>

    <section className="insight-banner">
      <div className="insight-icon"><Sparkles size={20} /></div><div><span>Suggestion Closia</span><p><strong>3 prospects sont prêts à être relancés.</strong> Leur activité récente indique un fort intérêt.</p></div><button onClick={() => onNavigate("Contacts")}>Voir les suggestions <ArrowRight size={15} /></button>
    </section>
  </>;
}

function PipelineView({ pipeline, onAdd, onMove }: { pipeline: PipelineColumn[]; onAdd: () => void; onMove: (id: string, currentStage: string, nextStage: string) => void }) {
  return <div className="kanban">{pipeline.map((column) => <section className="kanban-column" key={column.label}><div className="kanban-title" style={{ "--stage": column.color } as React.CSSProperties}><i /><span>{column.label}</span><b>{column.deals.length}</b><small>{column.value}</small></div>{column.deals.map(deal => <article className="kanban-card" key={deal.id}><div><span className={`avatar ${deal.tone}`}>{deal.initials}</span><MoreHorizontal size={17} /></div><h3>{deal.name}</h3><p>{deal.property}</p><footer><strong>{deal.value}</strong><select aria-label={`Déplacer ${deal.name}`} value={column.label} onChange={(event) => onMove(deal.id, column.label, event.target.value)}>{pipeline.map((stage) => <option key={stage.label}>{stage.label}</option>)}</select></footer></article>)}<button className="add-deal" onClick={onAdd}><Plus size={15} /> Ajouter une opportunité</button></section>)}</div>;
}

const temperatureDot: Record<string, string> = { Chaud: "🔥", "Tiède": "🌤️", Froid: "❄️" };
const quickFilters = ["Tous", "Nouveau", "À relancer", "Visite", "Offre déposée", "Signature", "Gagné", "Perdu"] as const;

function ConversationsView({ contacts, messages, selectedId, onSelect }: { contacts: UiContact[]; messages: UiMessage[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const threads = useMemo(() => {
    const byContact = new Map<string, UiMessage[]>();
    for (const m of messages) {
      if (!byContact.has(m.contactId)) byContact.set(m.contactId, []);
      byContact.get(m.contactId)!.push(m);
    }
    return contacts
      .filter((c) => byContact.has(c.id))
      .map((c) => ({ contact: c, thread: byContact.get(c.id)!.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }))
      .sort((a, b) => b.thread[b.thread.length - 1].createdAt.localeCompare(a.thread[a.thread.length - 1].createdAt));
  }, [contacts, messages]);

  const active = threads.find((t) => t.contact.id === selectedId) ?? threads[0] ?? null;

  if (threads.length === 0) {
    return <section className="panel"><div className="empty-state" style={{ minHeight: 340 }}><MessageSquareText size={28} /><b>Aucune conversation SMS pour l’instant</b><span>Les échanges avec vos leads apparaîtront ici automatiquement.</span></div></section>;
  }

  return (
    <div className="conversations-layout">
      <aside className="conv-list">
        {threads.map(({ contact, thread }) => {
          const last = thread[thread.length - 1];
          return (
            <button key={contact.id} className={`conv-item ${active?.contact.id === contact.id ? "active" : ""}`} onClick={() => onSelect(contact.id)}>
              <span className="avatar sand">{contact.initials}</span>
              <span className="conv-item__body">
                <b>{contact.name}</b>
                <small>{last.direction === "outbound" ? "Vous: " : ""}{last.body}</small>
              </span>
              {contact.temperature && <i className={`conv-dot ${contact.temperature}`}>{temperatureDot[contact.temperature]}</i>}
            </button>
          );
        })}
      </aside>

      {active && (
        <>
          <section className="conv-thread">
            <div className="conv-thread__header">
              <div><b>{active.contact.name}</b><small>{active.contact.phone}</small></div>
              <span className="status-pill">{active.contact.status}</span>
            </div>
            <div className="conv-thread__messages">
              {active.thread.map((m) => (
                <div key={m.id} className={`bubble ${m.direction}`}>
                  <p>{m.body}</p>
                  <time>{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(m.createdAt))}</time>
                </div>
              ))}
            </div>
            <div className="conv-thread__composer">
              <input disabled placeholder="Réponses gérées automatiquement par l’assistant IA — envoi manuel à venir" />
              <button disabled><ArrowRight size={16} /></button>
            </div>
          </section>

          <aside className="conv-info">
            <div className="conv-info__avatar">{active.contact.initials}</div>
            <h3>{active.contact.name}</h3>
            <p>{active.contact.role}{active.contact.source ? ` · ${active.contact.source}` : ""}</p>
            {active.contact.temperature && <span className={`temperature-pill ${active.contact.temperature}`}>{temperatureDot[active.contact.temperature]} {active.contact.temperature}</span>}
            <div className="conv-info__rows">
              <div><span>Statut</span><b>{active.contact.status}</b></div>
              {active.contact.budget && <div><span>Budget</span><b>{active.contact.budget}</b></div>}
              {active.contact.secteur && <div><span>Secteur</span><b>{active.contact.secteur}</b></div>}
              {active.contact.typePropriete && <div><span>Type de propriété</span><b>{active.contact.typePropriete}</b></div>}
              {active.contact.echeancier && <div><span>Échéancier</span><b>{active.contact.echeancier}</b></div>}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function ContactsView({ contacts, deletedContacts, onStatus, onConsent, onOpen, onDelete, onRestore, onDeleteForever, onEmptyTrash }: { contacts: UiContact[]; deletedContacts: UiContact[]; onStatus: (id: string, status: string) => void; onConsent: (id: string, channel: "email" | "sms", value: boolean) => void; onOpen: (id: string) => void; onDelete: (id: string) => void; onRestore: (id: string) => void; onDeleteForever: (id: string) => void; onEmptyTrash: () => void }) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<typeof quickFilters[number]>("Tous");
  const [showTrash, setShowTrash] = useState(false);
  const filtered = contacts
    .filter((contact) => activeFilter === "Tous" || contact.status === activeFilter)
    .filter((contact) => `${contact.name} ${contact.email} ${contact.phone}`.toLowerCase().includes(query.toLowerCase()));

  if (showTrash) {
    return <section className="panel data-panel">
      <div className="filter-bar"><button className="trash-back" onClick={() => setShowTrash(false)}><ArrowLeftFromLine size={14} /> Retour aux contacts</button><span className="result-count">{deletedContacts.length} dans la corbeille</span>{deletedContacts.length > 0 && <button className="empty-trash" onClick={() => { if (confirm("Supprimer définitivement tous ces contacts ? Cette action est irréversible.")) onEmptyTrash(); }}><Trash2 size={13} /> Vider la corbeille</button>}</div>
      <div className="contacts-table">
        <div className="contacts-head"><span>CONTACT</span><span>COORDONNÉES</span><span /><span /><span /></div>
        {deletedContacts.map((contact) => <div className="contact-row" key={contact.id}><div><span className="avatar sand">{contact.initials}</span><span><b>{contact.name}</b><small>{contact.role}</small></span></div><span><b>{contact.email}</b><small>{contact.phone}</small></span><span /><span /><div className="consent-controls"><button title="Restaurer" onClick={() => onRestore(contact.id)}><RotateCcw size={13} /></button><button title="Supprimer définitivement" onClick={() => { if (confirm("Supprimer définitivement ce contact ?")) onDeleteForever(contact.id); }}><Trash2 size={13} /></button></div></div>)}
        {deletedContacts.length === 0 && <div className="empty-state"><Trash2 size={22} /><b>La corbeille est vide</b><span>Les contacts supprimés apparaîtront ici.</span></div>}
      </div>
    </section>;
  }

  return <section className="panel data-panel">
    <div className="quick-filters">
      {quickFilters.map((label) => <button key={label} className={activeFilter === label ? "active" : ""} onClick={() => setActiveFilter(label)}>{label}{label !== "Tous" && <b>{contacts.filter((c) => c.status === label).length}</b>}</button>)}
      <button className="trash-toggle" onClick={() => setShowTrash(true)}><Trash2 size={13} /> Corbeille{deletedContacts.length > 0 && <b>{deletedContacts.length}</b>}</button>
    </div>
    <div className="filter-bar"><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un contact" /></div><span className="result-count">{filtered.length} contact{filtered.length > 1 ? "s" : ""}</span></div><div className="contacts-table"><div className="contacts-head"><span>CONTACT</span><span>COORDONNÉES</span><span>TEMPÉRATURE</span><span>STATUT</span><span /></div>{filtered.map((contact) => <div className="contact-row" key={contact.id} onClick={() => onOpen(contact.id)}><div><span className="avatar sand">{contact.initials}</span><span><b>{contact.name}</b><small>{contact.role}{contact.source ? ` · ${contact.source}` : ""}</small></span></div><span><b>{contact.email}</b><small>{contact.phone}</small></span><span className="temperature-tag">{contact.temperature ? <>{temperatureDot[contact.temperature]} {contact.temperature}</> : <small>—</small>}</span><select className="status-select" value={contact.status} onClick={(event) => event.stopPropagation()} onChange={(event) => onStatus(contact.id, event.target.value)}><option>Nouveau</option><option>À relancer</option><option>Visite</option><option>Offre déposée</option><option>Signature</option><option>Gagné</option><option>Perdu</option></select><div className="consent-controls" onClick={(event) => event.stopPropagation()}><button className={contact.consentEmail ? "allowed" : ""} title="Consentement e-mail" onClick={() => onConsent(contact.id, "email", !contact.consentEmail)}><Mail size={13} /></button><button className={contact.consentSms ? "allowed" : ""} title="Consentement SMS" onClick={() => onConsent(contact.id, "sms", !contact.consentSms)}><MessageSquareText size={13} /></button><button title="Mettre à la corbeille" onClick={() => onDelete(contact.id)}><Trash2 size={13} /></button></div></div>)}{filtered.length === 0 && <div className="empty-state"><ContactRound size={24} /><b>Aucun contact trouvé</b><span>Modifiez votre recherche ou ajoutez un contact.</span></div>}</div></section>;
}

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const WEBSITE_BASE_URL = "https://mohamedelberhdadi.ca";

type PropertyFormInput = { address: string; price: string; propertyType: string; bedrooms: number | null; bathrooms: number | null; areaSqft: number | null; photoUrl: string; description: string; contactId: string | null; international?: InternationalPropertyInput | null };

function PropertiesView({ properties, contacts, onCreate, onUpdate, onStatusChange, onDelete }: { properties: PropertyRow[]; contacts: UiContact[]; onCreate: (input: PropertyFormInput) => void; onUpdate: (id: string, input: PropertyFormInput) => void; onStatusChange: (id: string, status: PropertyRow["status"]) => void; onDelete: (id: string) => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyRow | null>(null);
  const statusClass: Record<string, string> = { "Disponible": "success", "Sous offre": "warning", "Vendue": "muted", "Retirée": "muted" };
  const showModal = modalOpen || editing !== null;
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  if (properties.length === 0 && !showModal) {
    return <>
      <div className="workspace-title" style={{ marginBottom: 14 }}><div><span>Propriétés</span><strong>0 fiche</strong></div><button onClick={() => setModalOpen(true)}><Plus size={16} /> Nouvelle propriété</button></div>
      <div className="empty-state" style={{ minHeight: 260 }}><Building2 size={26} /><b>Aucune propriété pour l’instant</b><span>Ajoutez votre première fiche de propriété à vendre.</span></div>
      {showModal && <PropertyModal contacts={contacts} initial={null} onClose={closeModal} onSave={(input) => { onCreate(input); closeModal(); }} />}
    </>;
  }

  return <>
    <div className="workspace-title" style={{ marginBottom: 14 }}><div><span>Propriétés</span><strong>{properties.length} fiche{properties.length > 1 ? "s" : ""}</strong></div><button onClick={() => setModalOpen(true)}><Plus size={16} /> Nouvelle propriété</button></div>
    <div className="property-grid">
      {properties.map((p) => (
        <article className="property-card" key={p.id}>
          <div className="property-image">
            {p.photo_url ? <img src={p.photo_url} alt={p.address} /> : <div className="property-image--placeholder"><Building2 size={28} /></div>}
            <span className={statusClass[p.status]}>{p.status}</span>
            {p.international && p.published && <span className="success" style={{ left: "auto", right: 12 }}><Globe2 size={12} /> International</span>}
          </div>
          <div>
            <small>{p.property_type || "Propriété"}{p.bedrooms ? ` · ${p.bedrooms} ch.` : ""}{p.bathrooms ? ` · ${p.bathrooms} sdb` : ""}</small>
            <h3>{p.address}</h3>
            <strong>{p.price || "Prix sur demande"}</strong>
            <div className="property-card__actions">
              <select value={p.status} onChange={(e) => onStatusChange(p.id, e.target.value as PropertyRow["status"])}>
                <option>Disponible</option><option>Sous offre</option><option>Vendue</option><option>Retirée</option>
              </select>
              <button onClick={() => setEditing(p)}><Pencil size={15} /></button>
              {p.international && p.published && p.slug && (
                <a href={`${WEBSITE_BASE_URL}/immobilier-international/propriete?slug=${p.slug}`} target="_blank" rel="noreferrer" title="Voir sur le site"><ExternalLink size={15} /></a>
              )}
              <button className="trash" onClick={() => { if (confirm("Supprimer cette fiche de propriété ?")) onDelete(p.id); }}><Trash2 size={15} /></button>
            </div>
          </div>
        </article>
      ))}
    </div>
    {showModal && <PropertyModal contacts={contacts} initial={editing} onClose={closeModal} onSave={(input) => { if (editing) onUpdate(editing.id, input); else onCreate(input); closeModal(); }} />}
  </>;
}

function PropertyModal({ contacts, initial, onClose, onSave }: { contacts: UiContact[]; initial: PropertyRow | null; onClose: () => void; onSave: (input: PropertyFormInput) => void }) {
  const [publier, setPublier] = useState(Boolean(initial?.international && initial?.published));
  const [titre, setTitre] = useState(initial?.titre || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [slugTouche, setSlugTouche] = useState(Boolean(initial?.slug));

  return (
    <div className="modal-layer"><form className="contact-modal" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const finalSlug = slug || slugify(titre || String(form.get("address") || ""));
      onSave({
        address: String(form.get("address")),
        price: String(form.get("price") || ""),
        propertyType: String(form.get("propertyType") || ""),
        bedrooms: form.get("bedrooms") ? Number(form.get("bedrooms")) : null,
        bathrooms: form.get("bathrooms") ? Number(form.get("bathrooms")) : null,
        areaSqft: form.get("areaSqft") ? Number(form.get("areaSqft")) : null,
        photoUrl: String(form.get("photoUrl") || ""),
        description: String(form.get("description") || ""),
        contactId: String(form.get("contactId") || "") || null,
        international: publier || initial?.international ? {
          publier,
          slug: finalSlug,
          titre: titre || String(form.get("address") || ""),
          pays: String(form.get("pays") || ""),
          ville: String(form.get("ville") || ""),
          region: String(form.get("region") || ""),
          drapeau: String(form.get("drapeau") || ""),
          codePostal: String(form.get("codePostal") || ""),
          devise: String(form.get("devise") || "CAD"),
          lat: form.get("lat") ? Number(form.get("lat")) : null,
          lng: form.get("lng") ? Number(form.get("lng")) : null,
          superficieM2: form.get("superficieM2") ? Number(form.get("superficieM2")) : null,
          caracteristiques: String(form.get("caracteristiques") || "").split(",").map((s) => s.trim()).filter(Boolean),
          photos: String(form.get("photos") || "").split("\n").map((s) => s.trim()).filter(Boolean),
          statut: String(form.get("statutIntl") || "À vendre"),
        } : null,
      });
    }}>
      <div className="modal-title"><div><span>Propriétés</span><h2>{initial ? "Modifier la fiche" : "Nouvelle fiche"}</h2></div><button type="button" onClick={onClose}><X size={20} /></button></div>
      <label>Adresse<input name="address" required defaultValue={initial?.address} placeholder="123 rue des Érables, Laval" /></label>
      <div className="form-grid">
        <label>Prix<input name="price" defaultValue={initial?.price ?? ""} placeholder="Ex. 549 000 $" /></label>
        <label>Type<select name="propertyType" defaultValue={initial?.property_type ?? ""}><option value="">Sélectionner</option><option>Maison</option><option>Condo</option><option>Immeuble à revenus</option><option>Terrain</option><option>Autre</option></select></label>
      </div>
      <div className="form-grid">
        <label>Chambres<input name="bedrooms" type="number" min={0} defaultValue={initial?.bedrooms ?? undefined} /></label>
        <label>Salles de bain<input name="bathrooms" type="number" min={0} defaultValue={initial?.bathrooms ?? undefined} /></label>
        <label>Superficie (pi²)<input name="areaSqft" type="number" min={0} defaultValue={initial?.area_sqft ?? undefined} /></label>
      </div>
      <label>Photo principale (lien URL, optionnel)<input name="photoUrl" defaultValue={initial?.photo_url ?? ""} placeholder="https://..." /></label>
      {contacts.length > 0 && <label>Vendeur associé (optionnel)<select name="contactId" defaultValue={initial?.contact_id ?? ""}><option value="">Aucun</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label>Description<textarea name="description" rows={3} defaultValue={initial?.description ?? ""} placeholder="Détails à retenir sur la propriété..." /></label>

      <label className="consent" style={{ marginTop: 6, marginBottom: 4 }}>
        <input type="checkbox" checked={publier} onChange={(e) => setPublier(e.target.checked)} />
        <span><Globe2 size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />Publier sur le site (section Immobilier International)</span>
      </label>

      {publier && (
        <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, padding: 12, marginTop: 6, marginBottom: 10 }}>
          <label>Titre affiché sur le site<input name="titre" value={titre} onChange={(e) => { setTitre(e.target.value); if (!slugTouche) setSlug(slugify(e.target.value)); }} placeholder="Ex. Villa Contemporaine avec Vue Mer" /></label>
          <label>Lien (slug)<input name="slug" value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouche(true); }} placeholder="villa-contemporaine-vue-mer" /></label>
          <div className="form-grid">
            <label>Pays<input name="pays" defaultValue={initial?.pays ?? ""} placeholder="France" /></label>
            <label>Drapeau (emoji)<input name="drapeau" defaultValue={initial?.drapeau ?? ""} placeholder="🇫🇷" /></label>
          </div>
          <div className="form-grid">
            <label>Ville<input name="ville" defaultValue={initial?.ville ?? ""} placeholder="Paris" /></label>
            <label>Région<input name="region" defaultValue={initial?.region ?? ""} placeholder="Île-de-France" /></label>
          </div>
          <div className="form-grid">
            <label>Code postal<input name="codePostal" defaultValue={initial?.code_postal ?? ""} /></label>
            <label>Devise<select name="devise" defaultValue={initial?.devise ?? "CAD"}><option>CAD</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option><option>MAD</option><option>CHF</option><option>AUD</option><option>MXN</option></select></label>
          </div>
          <div className="form-grid">
            <label>Superficie (m²)<input name="superficieM2" type="number" min={0} defaultValue={initial?.superficie_m2 ?? undefined} /></label>
            <label>Statut affiché<select name="statutIntl" defaultValue={initial?.statut ?? "À vendre"}><option>À vendre</option><option>À louer</option><option>Nouveau</option><option>Vedette</option></select></label>
          </div>
          <div className="form-grid">
            <label>Latitude (optionnel)<input name="lat" type="number" step="any" defaultValue={initial?.lat ?? undefined} placeholder="Ex. 48.8566" /></label>
            <label>Longitude (optionnel)<input name="lng" type="number" step="any" defaultValue={initial?.lng ?? undefined} placeholder="Ex. 2.3522" /></label>
          </div>
          <p className="settings-note">Si tu ne connais pas les coordonnées exactes, laisse vide — la propriété n'apparaîtra pas sur la carte mais restera visible dans la liste.</p>
          <label>Caractéristiques (séparées par des virgules)<input name="caracteristiques" defaultValue={initial?.caracteristiques?.join(", ") ?? ""} placeholder="Piscine, Garage, Vue mer" /></label>
          <label>Photos (une URL par ligne)<textarea name="photos" rows={3} defaultValue={initial?.photos?.join("\n") ?? ""} placeholder="https://...jpg" /></label>
        </div>
      )}

      <div className="modal-actions"><button type="button" onClick={onClose}>Annuler</button><button type="submit">{initial ? "Enregistrer" : "Créer la fiche"} <ArrowRight size={16} /></button></div>
    </form></div>
  );
}

function TasksWorkspace({ tasks, appointments, contacts, onAddTask, onAddAppointment, onToggle, onDelete, onDeleteAppointment }: { tasks: UiTask[]; appointments: UiAppointment[]; contacts: UiContact[]; onAddTask: () => void; onAddAppointment: () => void; onToggle: (id: string, done: boolean) => void; onDelete: (id: string) => void; onDeleteAppointment: (id: string) => void }) {
  const contactName = (id: string | null) => id ? contacts.find((c) => c.id === id)?.name : null;
  return <div className="workspace-grid"><section className="panel workspace-panel"><div className="workspace-title"><div><span>Tâches</span><strong>{tasks.filter((task) => !task.done).length} à faire</strong></div><button onClick={onAddTask}><Plus size={16} /> Nouvelle tâche</button></div><div className="work-list">{tasks.map((task) => <article className={task.done ? "is-done" : ""} key={task.id}><button className="work-check" onClick={() => onToggle(task.id, !task.done)}>{task.done && <Check size={13} />}</button><div><b>{task.title}</b><span>{task.description}{contactName(task.contactId) && <em className="linked-lead"> · {contactName(task.contactId)}</em>}</span></div><time>{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(task.dueAt))}</time><i className={`priority ${task.priority}`} /><button className="trash" onClick={() => onDelete(task.id)}><Trash2 size={15} /></button></article>)}</div></section><section className="panel workspace-panel"><div className="workspace-title"><div><span>Rendez-vous</span><strong>{appointments.length} planifiés</strong></div><button onClick={onAddAppointment}><Plus size={16} /> Rendez-vous</button></div><div className="appointment-list">{appointments.map((item) => <article key={item.id}><div className="appointment-date"><b>{new Date(item.startAt).getDate()}</b><span>{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(item.startAt))}</span></div><div><b>{item.title}</b><span><Clock3 size={12} /> {new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.startAt))}</span><span><MapPin size={12} /> {item.location || "Lieu à définir"}</span>{contactName(item.contactId) && <span><ContactRound size={12} /> {contactName(item.contactId)}</span>}</div><small>{item.status === "confirmed" ? "Confirmé" : "Planifié"}</small><button className="trash" onClick={() => onDeleteAppointment(item.id)}><Trash2 size={15} /></button></article>)}</div></section></div>;
}

function AutomationsView({ rules, logs, onToggle, onCreate, onDelete }: { rules: UiAutomation[]; logs: { id: string; channel: string; status: string; body: string; created_at: string }[]; onToggle: (id: string, active: boolean) => void; onCreate: (input: { name: string; channel: string; delayDays: number; template: string; consentRequired: boolean }) => void; onDelete: (id: string) => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  return <>
    <section className="integration-strip"><div><Mail size={19} /><span><b>E-mails Resend</b><small>Configuré</small></span></div><div><MessageSquareText size={19} /><span><b>SMS Twilio</b><small>Configuré</small></span></div><p>Une tâche automatique vérifie vos règles toutes les heures et envoie les relances aux leads inactifs.</p></section>
    <div className="workspace-title" style={{ marginBottom: 14 }}><div><span>Vos règles</span><strong>{rules.length} automatisation{rules.length > 1 ? "s" : ""}</strong></div><button onClick={() => setModalOpen(true)}><Plus size={16} /> Nouvelle automatisation</button></div>
    <div className="automation-grid">{rules.map((rule) => <article className="automation-card" key={rule.id}><header><span className={rule.channel}>{rule.channel === "email" ? <Mail size={17} /> : <MessageSquareText size={17} />}</span><div style={{ display: "flex", gap: 8, alignItems: "center" }}><button className={`switch ${rule.active ? "on" : ""}`} onClick={() => onToggle(rule.id, !rule.active)}><i /></button><button className="trash" onClick={() => { if (confirm(`Supprimer l’automatisation « ${rule.name} » ?`)) onDelete(rule.id); }}><Trash2 size={15} /></button></div></header><h3>{rule.name}</h3><p>{rule.trigger}</p><blockquote>{rule.template}</blockquote><footer><span>{rule.ai ? <><Sparkles size={13} /> Personnalisation IA</> : "Modèle fixe"}</span><b>{rule.active ? "Active" : "En pause"}</b></footer></article>)}
      {rules.length === 0 && <div className="empty-state"><Bot size={24} /><b>Aucune automatisation</b><span>Créez votre première règle de relance automatique.</span></div>}
    </div>
    <section className="panel log-panel"><div className="workspace-title"><div><span>Historique</span><strong>Derniers messages</strong></div></div>{logs.length === 0 ? <div className="empty-state"><MessageSquareText size={24} /><b>Aucun envoi réel</b><span>L’historique apparaîtra après le premier envoi automatique.</span></div> : logs.map((log) => <div className="log-row" key={log.id}><span>{log.channel}</span><p>{log.body}</p><b>{log.status}</b></div>)}</section>

    {modalOpen && (
      <div className="modal-layer"><form className="contact-modal" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onCreate({
          name: String(form.get("name")),
          channel: String(form.get("channel")),
          delayDays: Number(form.get("delayDays")) || 7,
          template: String(form.get("template")),
          consentRequired: form.get("consentRequired") === "on",
        });
        setModalOpen(false);
      }}>
        <div className="modal-title"><div><span>Automatisation</span><h2>Nouvelle règle de relance</h2></div><button type="button" onClick={() => setModalOpen(false)}><X size={20} /></button></div>
        <label>Nom de la règle<input name="name" required placeholder="Relance après 7 jours d’inactivité" /></label>
        <div className="form-grid">
          <label>Canal<select name="channel" defaultValue="email"><option value="email">Courriel</option><option value="sms">SMS</option></select></label>
          <label>Délai d’inactivité (jours)<input name="delayDays" type="number" min={1} max={365} defaultValue={7} required /></label>
        </div>
        <label>Message<textarea name="template" required rows={4} placeholder="Bonjour {{prenom}}, souhaitez-vous reprendre votre recherche immobilière ?" /></label>
        <p className="settings-note">Variables disponibles : {"{{prenom}}"}, {"{{nom}}"}, {"{{secteur}}"}, {"{{budget}}"}</p>
        <label className="consent" style={{ marginTop: 10 }}><input type="checkbox" name="consentRequired" defaultChecked /><span>Respecter le consentement du contact avant l’envoi</span></label>
        <div className="modal-actions"><button type="button" onClick={() => setModalOpen(false)}>Annuler</button><button type="submit">Créer <ArrowRight size={16} /></button></div>
      </form></div>
    )}
  </>;
}

function PricingView({ yearly, setYearly, currentPlan, onChoose }: { yearly: boolean; setYearly: (value: boolean) => void; currentPlan: string; onChoose: (plan: "solo" | "agency" | "pro_ai") => void }) {
  const plans = [{ id: "solo", name: "Solo", price: 29, description: "Pour le courtier indépendant", features: ["1 utilisateur", "Contacts et pipeline", "Tâches et rendez-vous"] }, { id: "agency", name: "Agence", price: 69, description: "Pour une équipe qui grandit", features: ["5 utilisateurs", "Automatisations e-mail", "Rapports d’équipe"] }, { id: "pro_ai", name: "Pro IA", price: 129, description: "Pour convertir à grande échelle", features: ["Utilisateurs illimités", "Agent IA et SMS", "Support prioritaire"] }];
  return <><div className="billing-toggle"><span>Mensuel</span><button className={yearly ? "on" : ""} onClick={() => setYearly(!yearly)}><i /></button><span>Annuel <b>2 mois offerts</b></span></div><div className="pricing-grid">{plans.map((plan, index) => { const price = yearly ? Math.round(plan.price * 10 / 12) : plan.price; return <article className={`pricing-card ${index === 1 ? "recommended" : ""}`} key={plan.id}>{index === 1 && <em>LE PLUS CHOISI</em>}<span>{plan.name}</span><h3>{price} $ CA<small>/mois</small></h3><p>{plan.description}</p><div>{plan.features.map((feature) => <span key={feature}><Check size={14} /> {feature}</span>)}</div><button onClick={() => onChoose(plan.id as "solo" | "agency" | "pro_ai")}>{currentPlan === plan.id ? "Forfait actuel" : "Choisir ce forfait"}<ArrowRight size={15} /></button><small className="launch-offer">Offre lancement : −30 % pendant 3 mois</small></article>})}</div><p className="stripe-note">Paiement sécurisé Stripe — configuration requise avant la première vente.</p></>;
}

function PasswordForm({ onSubmit, submitLabel = "Changer le mot de passe", onCancel }: { onSubmit: (password: string) => Promise<void>; submitLabel?: string; onCancel?: () => void }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <form className="password-form" onSubmit={async (event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      const password = String(form.get("newPassword") || "");
      const confirmation = String(form.get("confirmPassword") || "");
      if (password.length < 8) return setMessage("Le mot de passe doit contenir au moins 8 caractères.");
      if (password !== confirmation) return setMessage("Les deux mots de passe ne correspondent pas.");
      setSaving(true); setMessage("");
      try { await onSubmit(password); formElement.reset(); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Modification impossible"); }
      finally { setSaving(false); }
    }}>
      <label>Nouveau mot de passe<input name="newPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" /></label>
      <label>Confirmer le mot de passe<input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="Retapez le mot de passe" /></label>
      {message && <p className="auth-message" role="alert">{message}</p>}
      <div className="modal-actions">
        {onCancel && <button type="button" onClick={onCancel}>Plus tard</button>}
        <button disabled={saving} type="submit">{saving ? "Enregistrement…" : submitLabel}</button>
      </div>
    </form>
  );
}

function SettingsView({ industry, canChangePassword, onChangePassword }: { industry: string; canChangePassword: boolean; onChangePassword: (password: string) => Promise<void> }) {
  const industryLabels: Record<string, string> = { immobilier: "Immobilier", sante: "Santé", esthetique: "Esthétique", conciergerie: "Conciergerie" };
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <h2>Langue de l’interface</h2>
        <p>Le CRM est actuellement disponible en <b>Français</b> uniquement.</p>
      </section>

      <section className="panel settings-panel">
        <h2>Secteur d’activité</h2>
        <p>Votre agence est configurée pour le secteur : <b>{industryLabels[industry] || industry}</b></p>
        <p className="settings-note">Ce réglage est défini à la création de l’agence et adapte le vocabulaire du tableau de bord (ex. « Acheteurs/Vendeurs » pour l’immobilier).</p>
      </section>

      {canChangePassword && (
        <section className="panel settings-panel">
          <h2>Mot de passe</h2>
          <p>Choisissez un mot de passe d’au moins 8 caractères que vous n’utilisez nulle part ailleurs.</p>
          <PasswordForm onSubmit={onChangePassword} />
        </section>
      )}
    </div>
  );
}

function TeamView({ members, organizationId, onAnnounce, onRemove, onRestore, onDeleteForever, onEmptyTrash }: { members: TeamMemberRow[]; organizationId: string | null; onAnnounce: (s: string) => void; onRemove: (id: string) => void; onRestore: (id: string) => void; onDeleteForever: (id: string) => void; onEmptyTrash: () => void }) {
  const [showTrash, setShowTrash] = useState(false);
  if (!organizationId) {
    return <div className="team-grid">{team.map((m, i) => <article className="team-card" key={m.name}><div className={`member-portrait member-${i}`}>{m.initials}</div><h3>{m.name}</h3><p>{m.role}</p><div><span><small>Pipeline</small><b>{m.amount}</b></span><span><small>En cours</small><b>{m.deals}</b></span></div><button>Voir le profil <ArrowRight size={15} /></button></article>)}</div>;
  }
  const activeMembers = members.filter((m) => m.active);
  const removedMembers = members.filter((m) => !m.active);

  if (showTrash) {
    return (
      <section className="panel data-panel">
        <div className="filter-bar">
          <button className="trash-back" onClick={() => setShowTrash(false)}><ArrowLeftFromLine size={14} /> Retour à l’équipe</button>
          <span className="result-count">{removedMembers.length} retiré{removedMembers.length > 1 ? "s" : ""}</span>
          {removedMembers.length > 0 && <button className="empty-trash" onClick={() => { if (confirm("Supprimer définitivement ces membres ? Cette action est irréversible.")) onEmptyTrash(); }}><Trash2 size={13} /> Vider la corbeille</button>}
        </div>
        <div className="team-grid">
          {removedMembers.map((m) => (
            <article className="team-card" key={m.id}>
              <div className="member-portrait member-0">{m.full_name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}</div>
              <h3>{m.full_name}</h3>
              <p>Retiré de l’équipe</p>
              <div className="button-row" style={{ marginTop: 10 }}>
                <button className="trash-action" onClick={() => onRestore(m.id)}><RotateCcw size={13} /> Restaurer</button>
                <button className="trash-action danger" onClick={() => { if (confirm(`Supprimer définitivement ${m.full_name} ?`)) onDeleteForever(m.id); }}><Trash2 size={13} /> Supprimer</button>
              </div>
            </article>
          ))}
          {removedMembers.length === 0 && <div className="empty-state"><Trash2 size={22} /><b>Aucun membre retiré</b><span>Les membres retirés de l’équipe apparaîtront ici.</span></div>}
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="invite-card">
        <div>
          <b>Code d’invitation de votre agence</b>
          <p>Partagez ce code avec les membres de votre équipe (jusqu’à 10 personnes). Ils le colleront lors de leur inscription pour rejoindre automatiquement votre agence, avec accès aux mêmes contacts et données.</p>
        </div>
        <div className="invite-card__code">
          <code>{organizationId}</code>
          <button type="button" onClick={() => { navigator.clipboard.writeText(organizationId); onAnnounce("Code copié dans le presse-papiers"); }}><Copy size={14} /> Copier</button>
        </div>
      </div>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <span className="result-count">{activeMembers.length} membre{activeMembers.length > 1 ? "s" : ""} actif{activeMembers.length > 1 ? "s" : ""}</span>
        <button className="trash-toggle" onClick={() => setShowTrash(true)}><Trash2 size={13} /> Corbeille{removedMembers.length > 0 && <b>{removedMembers.length}</b>}</button>
      </div>
      <div className="team-grid">
        {activeMembers.map((m) => (
          <article className="team-card" key={m.id}>
            <div className="member-portrait member-0">{m.full_name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}</div>
            <h3>{m.full_name}</h3>
            <p>{m.role === "owner" ? "Propriétaire de l’agence" : "Membre de l’équipe"}</p>
            {m.role !== "owner" && <button className="trash-action danger" style={{ marginTop: 12 }} onClick={() => { if (confirm(`Retirer ${m.full_name} de l’équipe ? Cette personne perdra immédiatement l’accès au CRM.`)) onRemove(m.id); }}><UserMinus size={13} /> Retirer</button>}
          </article>
        ))}
        {activeMembers.length < 10 && (
          <article className="team-card team-card--empty">
            <UsersRound size={22} />
            <p>Partagez le code d’invitation ci-dessus pour ajouter jusqu’à {10 - activeMembers.length} personne{10 - activeMembers.length > 1 ? "s" : ""} de plus.</p>
          </article>
        )}
      </div>
    </div>
  );
}

export default App;
