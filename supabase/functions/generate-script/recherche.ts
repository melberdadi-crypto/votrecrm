// Contenu ciblé par type de propriété (condo, maison, duplex, triplex, quadruplex, terrain), pour deux publics :
//  - « vendeurs »  (type_contenu = recherche) : « On recherche un duplex : j'ai des acheteurs ». Critères tirés des vrais acheteurs du CRM.
//  - « acheteurs » (type_contenu = acheteurs) : « Vous cherchez un duplex ? Je vous accompagne ». Aucun inventaire inventé.
// Aucune donnée personnelle (nom, courriel, téléphone) n'est lue ni envoyée à l'IA.
// deno-lint-ignore-file no-explicit-any

export type Public = "vendeurs" | "acheteurs";
export const estPublic = (p: unknown): p is Public => p === "vendeurs" || p === "acheteurs";

// motif : valeur de contacts.type_propriete (« Duplex », « Triplex »… ; les anciens leads Meta ont « duplex / triplex », compté pour les deux)
export const TYPES_RECHERCHE: Record<string, { motif: string; libelle: string; libelleDemande: string; motCle: string; hashtag: string }> = {
  condo: { motif: "condo%", libelle: "condo", libelleDemande: "un condo ou un appartement", motCle: "CONDO", hashtag: "#Condo" },
  maison: { motif: "maison%", libelle: "maison", libelleDemande: "une maison", motCle: "MAISON", hashtag: "#Maison" },
  duplex: { motif: "%duplex%", libelle: "duplex", libelleDemande: "un duplex", motCle: "DUPLEX", hashtag: "#Duplex" },
  triplex: { motif: "%triplex%", libelle: "triplex", libelleDemande: "un triplex", motCle: "TRIPLEX", hashtag: "#Triplex" },
  quadruplex: { motif: "%quadru%", libelle: "quadruplex", libelleDemande: "un quadruplex", motCle: "QUADRUPLEX", hashtag: "#Quadruplex" },
  terrain: { motif: "terrain%", libelle: "terrain", libelleDemande: "un terrain", motCle: "TERRAIN", hashtag: "#Terrain" },
};
// Rotation quotidienne (le terrain reste disponible à la demande)
export const ROTATION = ["duplex", "maison", "condo", "triplex", "quadruplex"];
export const estTypeRecherche = (t: unknown): t is string => typeof t === "string" && t in TYPES_RECHERCHE;

export type Demande = {
  type_propriete: string;
  libelle: string;
  libelle_demande: string;
  mot_cle: string;
  hashtag: string;
  nb_acheteurs: number;
  preapprouves: number;
  budgets: Record<string, number>;
  echeanciers: Record<string, number>;
  secteurs: string[];
  secteur_choisi?: string;
  budget_choisi?: string;
};

// Territoire des publications : Laval, Rive-Nord jusqu'à Saint-Sauveur, Lanaudière jusqu'à L'Assomption
export const TERRITOIRE = "Territoire desservi, à respecter strictement : Laval, la Rive-Nord de Montréal (vers le nord jusqu'à Saint-Jérôme, Prévost et Saint-Sauveur au maximum) et le sud de Lanaudière (Terrebonne, Mascouche, Repentigny, Charlemagne, jusqu'à L'Assomption au maximum). Ne présente jamais Montréal, la Rive-Sud ni une ville hors de ce territoire comme secteur desservi ou recherché.";
const VILLES_TERRITOIRE = [
  "laval", "chomedey", "sainte rose", "ste rose", "vimont", "auteuil", "fabreville", "duvernay", "pont viau", "laval des rapides", "sainte dorothee", "saint francois", "saint vincent de paul",
  "rive nord", "boisbriand", "sainte therese", "ste therese", "blainville", "rosemere", "lorraine", "bois des filion", "sainte anne des plaines", "saint eustache", "st eustache",
  "deux montagnes", "mirabel", "saint jerome", "st jerome", "prevost", "piedmont", "saint sauveur", "st sauveur", "sainte anne des lacs", "saint colomban", "sainte sophie", "laurentide",
  "terrebonne", "lachenaie", "la plaine", "mascouche", "repentigny", "le gardeur", "charlemagne", "assomption", "lanaudiere",
];
const normaliser = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
// Acheteur compatible : secteur dans le territoire, ou sans préférence
const dansTerritoire = (secteur: string | null) => {
  const n = normaliser(secteur || "");
  if (!n || /pas de choix|peu importe|aucun|n importe/.test(n)) return true;
  return VILLES_TERRITOIRE.some((v) => n.includes(v));
};

const propre = (v: string) => v.replace(/_/g, " ").replace(/\s+/g, " ").trim();
const compter = (valeurs: (string | null)[]) => {
  const c: Record<string, number> = {};
  for (const v of valeurs) if (v && v.trim()) c[propre(v)] = (c[propre(v)] || 0) + 1;
  return Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]));
};

// Lit la demande réelle. Sans acheteur pour ce type, nb_acheteurs = 0 (l'appelant décide).
export async function demandeAcheteurs(admin: any, orgId: string, type: string, filtres: { secteur?: string; budget?: string } = {}): Promise<Demande> {
  const t = TYPES_RECHERCHE[type];
  const { data, error } = await admin.from("contacts").select("type_propriete, secteur, budget, echeancier, preapprobation")
    .eq("organization_id", orgId).eq("project", "Achat").is("deleted_at", null).ilike("type_propriete", t.motif);
  if (error) throw new Error("Lecture des acheteurs : " + error.message);
  const tous = (data || []) as { type_propriete: string | null; secteur: string | null; budget: string | null; echeancier: string | null; preapprobation: string | null }[];
  // Seuls les acheteurs qui cherchent dans le territoire comptent (pas ceux qui ne veulent que Montréal, par exemple)
  const rows = tous.filter((r) => dansTerritoire(r.secteur));
  // Des acheteurs qui acceptent « duplex ou triplex » : on le dit tel quel
  const mixte = (type === "duplex" || type === "triplex") && rows.some((r) => /duplex/i.test(r.type_propriete || "") && /triplex/i.test(r.type_propriete || ""));
  return {
    type_propriete: type,
    libelle: t.libelle,
    libelle_demande: mixte ? "un duplex ou un triplex" : t.libelleDemande,
    mot_cle: t.motCle,
    hashtag: t.hashtag,
    nb_acheteurs: rows.length,
    preapprouves: rows.filter((r) => r.preapprobation && /^(oui|yes|pr[ée]-?approuv)/i.test(r.preapprobation.trim())).length,
    budgets: compter(rows.map((r) => r.budget)),
    echeanciers: compter(rows.map((r) => r.echeancier)),
    secteurs: [...new Set(rows.map((r) => r.secteur).filter((s): s is string => !!s && !/pas de choix/i.test(s)).map(propre))],
    // Les secteurs listés peuvent contenir des villes hors territoire (ex. « Montréal, Laval ») : l'IA ne garde que le territoire
    secteur_choisi: filtres.secteur?.trim() || undefined,
    budget_choisi: filtres.budget?.trim() || undefined,
  };
}

export function exigerAcheteurs(d: Demande) {
  if (!d.nb_acheteurs) {
    throw new Error(`Aucun acheteur ne cherche ${d.libelle_demande} dans le CRM : une annonce « On recherche un ${d.libelle} » ne serait pas honnête. Choisissez le public « acheteurs » ou un autre type.`);
  }
}

// Ce que l'IA a le droit d'affirmer (public vendeurs)
function faitsDemande(d: Demande) {
  return `
- Type de propriété de l'annonce : ${d.libelle}
- Mes acheteurs actifs cherchent ${d.libelle_demande} : ${d.nb_acheteurs} acheteur(s)${d.libelle_demande.includes(" ou ") ? ` (ils acceptent l'un ou l'autre : écris « des acheteurs qui cherchent ${d.libelle_demande} », jamais « ${d.nb_acheteurs} acheteurs de ${d.libelle} »)` : ""}
- Acheteurs pré-approuvés : ${d.preapprouves} ${d.preapprouves === 0 ? "(NE PAS écrire « pré-approuvés » ni « financement confirmé »)" : ""}
- Budgets (nombre d'acheteurs) : ${Object.entries(d.budgets).map(([b, n]) => `${b} (${n})`).join(" ; ") || "non précisé"}
- Échéanciers : ${Object.entries(d.echeanciers).map(([e, n]) => `${e} (${n})`).join(" ; ") || "non précisé"}
- Secteurs souhaités (tels que saisis par les acheteurs ; ne garde QUE les villes du territoire, regroupées proprement) : ${d.secteurs.join(" ; ") || "non précisé"}
${d.secteur_choisi ? `- SECTEUR IMPOSÉ pour cette annonce : ${d.secteur_choisi}` : ""}
${d.budget_choisi ? `- BUDGET IMPOSÉ pour cette annonce : ${d.budget_choisi}` : ""}`;
}

// Faits vérifiés utilisables pour le public acheteurs (aucun autre chiffre)
const FAITS_ACHETEURS = `
- Mise de fonds minimale : 5 % jusqu'à 500 000 $ ; 5 % des premiers 500 000 $ + 10 % du reste jusqu'à 1 499 999 $ ; 20 % à partir de 1,5 M$.
- Taxe de bienvenue à Laval en 2026 : 0,5 % jusqu'à 62 900 $, 1 % de 62 900 $ à 315 000 $, 1,5 % de 315 000 $ à 500 000 $, 3 % au-delà de 500 000 $.
- Premiers acheteurs : depuis 2026, Québec rembourse jusqu'à 5 875 $ de taxe de bienvenue (crédit réduit au-delà de 750 000 $, nul à 1 M$). RAP : jusqu'à 60 000 $ du REER. CELIAPP : 8 000 $ par année, 40 000 $ au total.
- Marché de Laval, août 2026 (APCIQ) : prix médian unifamiliale 642 750 $, copropriété 449 000 $, environ 10 % plus de propriétés à vendre qu'un an plus tôt.
- Plex (duplex, triplex, quadruplex) : propriété à revenus ; on peut habiter un logement et louer les autres. Points à vérifier : baux en cours, revenus et dépenses réels, état de la bâtisse, inspection préachat.
- Condo : lire les documents du syndicat (procès-verbaux, fonds de prévoyance, étude de fonds).
`;

const REGLES =
  "Règles absolues : tu n'inventes AUCUN chiffre, aucun critère, aucune propriété à vendre et aucun acheteur qui ne figure pas dans les faits fournis. " +
  "Tu peux arrondir vers le bas (« plusieurs acheteurs ») mais jamais vers le haut. Aucun nom, aucune information personnelle. " +
  "Pas de promesse de vente garantie, de prix garanti, de délai garanti ni de rendement. Tu regroupes les secteurs en zones claires (ex. Laval, Rive-Nord, Lanaudière) sans en ajouter. " +
  TERRITOIRE + " " +
  "Tu écris en français québécois, ton chaleureux, professionnel et direct, VOUVOIEMENT. Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.";

const SYSTEME = "Tu es le responsable des réseaux sociaux de Mohamed El Berhdadi, courtier immobilier résidentiel à Laval (Vendirect inc.), qui couvre Laval, la Rive-Nord de Montréal (jusqu'à Saint-Sauveur) et Lanaudière (jusqu'à L'Assomption). " + REGLES;

// L'IA met parfois de vrais retours à la ligne dans les chaînes JSON : on les échappe avant JSON.parse
function parseJson(brut: string) {
  const start = brut.indexOf("{"), end = brut.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Réponse IA sans JSON");
  let sortie = "", dansChaine = false, echappe = false;
  for (const c of brut.slice(start, end + 1)) {
    if (dansChaine) {
      if (echappe) { echappe = false; sortie += c; continue; }
      if (c === "\\") { echappe = true; sortie += c; continue; }
      if (c === '"') dansChaine = false;
      sortie += c === "\n" ? "\\n" : c === "\r" ? "" : c === "\t" ? "\\t" : c;
    } else {
      if (c === '"') dansChaine = true;
      sortie += c;
    }
  }
  return JSON.parse(sortie);
}

async function appelClaude(apiKey: string, user: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 3000, thinking: { type: "disabled" }, system: SYSTEME, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`API Claude ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return parseJson((data.content || []).map((c: { text?: string }) => c.text || "").join(""));
}

const sansEmoji = (t: string) => t.replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s{2,}/g, " ").trim();

function brief(pub: Public, d: Demande, recents: string[]) {
  const deja = `Accroches déjà utilisées récemment (à NE PAS répéter) :\n${recents.map((r) => "- " + r).join("\n") || "- aucune"}\n`;
  if (pub === "vendeurs") {
    return {
      intro: `Le message s'adresse aux PROPRIÉTAIRES qui pensent vendre leur ${d.libelle} : « j'ai des acheteurs pour votre propriété ».\n\nFAITS (les seuls que tu peux utiliser) :${faitsDemande(d)}\n\n${deja}`,
      kicker: "On recherche",
      exTitre: `« ${d.libelle.charAt(0).toUpperCase() + d.libelle.slice(1)} recherché à Laval et sur la Rive-Nord »`,
      cta: `évaluation gratuite et sans engagement`,
    };
  }
  return {
    intro: `Le message s'adresse aux ACHETEURS qui cherchent un ${d.libelle} à Laval, sur la Rive-Nord ou dans Lanaudière : « vous cherchez un ${d.libelle} ? je vous accompagne ». ` +
      `Donne UNE raison concrète ou UN conseil utile propre à ce type de propriété, puis l'offre d'accompagnement (recherche ciblée, visites, analyse, négociation). N'affirme jamais avoir des ${d.libelle}s à vendre.\n\nFAITS VÉRIFIÉS (les seuls chiffres permis) :${FAITS_ACHETEURS}\n${deja}`,
    kicker: "Acheteurs",
    exTitre: `« Vous cherchez un ${d.libelle} à Laval ? »`,
    cta: `écrire pour lancer une recherche personnalisée`,
  };
}

// Publication Facebook + Instagram + textes de l'affiche
export async function genererPublicationCiblee(apiKey: string, pub: Public, d: Demande, signature: string, recents: string[] = []) {
  const b = brief(pub, d, recents);
  const user =
    `Crée une publication ciblée « ${d.libelle} » pour les ${pub}.\n${b.intro}\n` +
    `Rends ce JSON :\n{\n` +
    `  "theme": "${b.kicker} : ${d.libelle} + angle, 3 à 8 mots",\n` +
    `  "kicker": "${b.kicker}",\n` +
    `  "titre_visuel": "accroche de l'affiche, 25 à 60 caractères, SANS emoji (ex. ${b.exTitre})",\n` +
    `  "sous_titre": "60 à 110 caractères, SANS emoji, qui complète l'accroche et invite à écrire",\n` +
    `  "texte_facebook": "60 à 120 mots, appel à l'action : ${b.cta} sur https://mohamedelberhdadi.ca, emojis avec modération, puis une ligne vide et exactement : ${signature}",\n` +
    `  "texte_instagram": "50 à 100 mots, sans lien cliquable, appel à l'action : « Écrivez ${d.mot_cle} en message privé », puis une ligne vide, exactement : ${signature}, puis une ligne vide et 5 à 7 hashtags (${pub === "vendeurs" ? "#OnRecherche, " : ""}${d.hashtag}, #ImmobilierLaval, zones...)",\n` +
    `  "zone": "zone visée, ex. Laval et Rive-Nord"\n}`;
  const p = await appelClaude(apiKey, user);
  for (const k of ["theme", "kicker", "titre_visuel", "sous_titre", "texte_facebook", "texte_instagram"]) {
    if (typeof p[k] !== "string" || !p[k].trim()) throw new Error(`Champ manquant : ${k}`);
  }
  for (const k of ["kicker", "titre_visuel", "sous_titre"]) p[k] = sansEmoji(p[k]);
  return p as Record<string, string>;
}

// Script de reel court (15 à 30 s) au même format que les autres scripts
export async function genererReelCible(apiKey: string, pub: Public, d: Demande, signature: string, recents: string[] = []) {
  const b = brief(pub, d, recents);
  const user =
    `Écris un script de Reel Instagram/TikTok court et direct, face caméra, ciblé « ${d.libelle} » pour les ${pub}.\n${b.intro}\n` +
    `Rends ce JSON :\n{\n` +
    `  "titre": "sujet interne en 4 à 8 mots",\n` +
    `  "zone": "zone visée, ex. Laval et Rive-Nord",\n` +
    `  "accroche": "texte à l'écran pour les 3 premières secondes, 20 à 40 caractères, sans emoji",\n` +
    `  "parties": [\n` +
    `    {"partie": "Accroche", "texte": "1 phrase choc qui interpelle les ${pub}"},\n` +
    `    {"partie": "${pub === "vendeurs" ? "Ce que je cherche" : "Le conseil"}", "texte": "..."},\n` +
    `    {"partie": "${pub === "vendeurs" ? "Pourquoi m'écrire" : "Comment je vous aide"}", "texte": "..."},\n` +
    `    {"partie": "Appel à l'action", "texte": "Mohamed, courtier à Laval et sur la Rive-Nord : « Écrivez-moi ${d.mot_cle} en message privé »"}\n` +
    `  ],\n` +
    `  "duree_secondes": estimation de 15 à 30,\n` +
    `  "conseils_tournage": "2 ou 3 conseils : filmer devant un ${d.libelle} typique de la zone (sans adresse visible), texte à l'écran, plan de coupe",\n` +
    `  "legende": "légende de 40 à 70 mots qui invite à écrire ${d.mot_cle} en message privé, puis une ligne vide, exactement : ${signature}, puis une ligne vide et 5 à 7 hashtags"\n}\n` +
    `Le texte parlé total doit faire entre 45 et 80 mots.`;
  const s = await appelClaude(apiKey, user);
  if (!Array.isArray(s.parties) || !s.parties.length) throw new Error("Script vide");
  return {
    titre: String(s.titre || `${b.kicker} : ${d.libelle}`).slice(0, 120),
    zone: String(s.zone || d.secteur_choisi || "Laval et Rive-Nord").slice(0, 80),
    accroche: sansEmoji(String(s.accroche || "")).slice(0, 60),
    parties: s.parties.map((p: { partie: string; texte: string }) => ({ partie: String(p.partie || ""), texte: String(p.texte || "").trim() })).filter((p: { texte: string }) => p.texte),
    duree_secondes: Number(s.duree_secondes) || null,
    conseils_tournage: String(s.conseils_tournage || ""),
    legende: String(s.legende || ""),
    sources: [],
  };
}

// type_contenu (publications) / type (reels) selon le public
// Lien du site qui ouvre le bon formulaire, prérempli, et rattache le lead à la publication
export const lienCampagne = (pub: Public, d: Demande, postId: string) =>
  `https://mohamedelberhdadi.ca/?projet=${pub === "vendeurs" ? "vendeur" : "acheteur"}&type=${encodeURIComponent(d.libelle.charAt(0).toUpperCase() + d.libelle.slice(1))}&campagne=${postId}&src=facebook#leads`;
export const avecLienCampagne = (texte: string, lien: string) =>
  texte.replace(/https?:\/\/(www\.)?mohamedelberhdadi\.ca\/?(?=[\s)\].,!?;:]|$)/g, lien);

export const typeContenuDe = (pub: Public) => (pub === "vendeurs" ? "recherche" : "acheteurs");

// Résumé stocké dans la colonne `cible` (aucune donnée personnelle)
export const cibleDe = (pub: Public, d: Demande, zone?: string) => ({
  public: pub,
  type_propriete: d.type_propriete,
  libelle: d.libelle,
  mot_cle: d.mot_cle,
  zone: zone || d.secteur_choisi || null,
  budget: pub === "vendeurs" ? d.budget_choisi || Object.keys(d.budgets)[0] || null : null,
  nb_acheteurs: pub === "vendeurs" ? d.nb_acheteurs : null,
});

// Type du jour pour un public : rotation, et pour les vendeurs on saute les types sans acheteurs
export async function typeDuJour(admin: any, orgId: string, pub: Public, jour: number) {
  const depart = (jour + (pub === "acheteurs" ? 2 : 0)) % ROTATION.length;
  for (let i = 0; i < ROTATION.length; i++) {
    const type = ROTATION[(depart + i) % ROTATION.length];
    const d = await demandeAcheteurs(admin, orgId, type);
    if (pub === "acheteurs" || d.nb_acheteurs > 0) return d;
  }
  return null;
}
