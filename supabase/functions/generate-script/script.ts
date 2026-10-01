// Génération du script de Reel du jour (Instagram / TikTok) avec recherche web pour les nouveautés locales.

export const VILLES = [
  // Laval (plusieurs quartiers : Laval revient plus souvent)
  "Laval (Chomedey)", "Laval (Sainte-Rose)", "Laval (Vimont et Auteuil)", "Laval (Laval-des-Rapides et Pont-Viau)",
  "Laval (Sainte-Dorothée et Laval-Ouest)", "Laval (Duvernay et Saint-Vincent-de-Paul)", "Laval (Fabreville)",
  // Rive-Nord jusqu'à Mirabel
  "Boisbriand", "Sainte-Thérèse", "Blainville", "Rosemère", "Lorraine", "Bois-des-Filion", "Sainte-Anne-des-Plaines",
  "Saint-Eustache", "Deux-Montagnes", "Mirabel",
  // Lanaudière
  "Terrebonne", "Mascouche", "Repentigny", "L'Assomption", "Lavaltrie", "Saint-Lin–Laurentides", "Joliette",
];
export const PUBLICS = ["vendeurs", "acheteurs", "premiers acheteurs", "nouveaux arrivants"];

// Banque d'angles par public : l'IA en reçoit 3 au hasard pour varier les sujets
const ANGLES: Record<string, string[]> = {
  vendeurs: [
    "fixer le bon prix (analyse comparative des ventes récentes du secteur)", "préparer la maison avant les photos (désencombrer, petits travaux rentables)",
    "le meilleur moment de l'année pour vendre", "les erreurs qui font perdre des acheteurs dès la première visite", "vendre et acheter en même temps : l'ordre des étapes",
    "comment se passe une visite libre et qui y vient", "les frais à prévoir quand on vend (quittance de l'hypothèque, pénalité, certificat de localisation)",
    "négocier une offre : prix, conditions, date d'occupation", "ce qu'un acheteur regarde en premier dans ce secteur",
  ],
  acheteurs: [
    "les questions à poser lors d'une visite", "l'inspection préachat : pourquoi et à quoi s'attendre", "maison, condo ou plex : quoi choisir dans ce secteur",
    "la promesse d'achat et ses conditions (financement, inspection)", "les frais cachés au-delà du prix (taxe de bienvenue, notaire, ajustements)",
    "acheter un condo : lire les documents du syndicat et le fonds de prévoyance", "bien choisir son quartier (transport, écoles, services)",
    "faire une offre dans un marché compétitif sans se mettre à risque", "acheter une propriété à revenus : points de vigilance",
  ],
  "premiers acheteurs": [
    "RAP et CELIAPP : bâtir sa mise de fonds", "le remboursement de la taxe de bienvenue pour premier acheteur", "la préapprobation hypothécaire avant de magasiner",
    "l'amortissement de 30 ans et son impact", "le test de résistance expliqué simplement", "le budget réel d'une première maison (taxes, assurances, entretien)",
    "condo ou maison pour un premier achat", "les étapes d'un premier achat de A à Z", "les erreurs fréquentes des premiers acheteurs",
  ],
  "nouveaux arrivants": [
    "choisir sa ville selon son mode de vie (transport vers Montréal, écoles, parcs)", "louer d'abord ou acheter tout de suite",
    "obtenir un prêt hypothécaire en étant nouveau au Canada (en général, sans promettre de conditions précises)", "le rôle du courtier immobilier et du notaire au Québec",
    "comprendre les taxes municipales et scolaires", "la vie dans ce secteur : services, communautés, activités", "le transport collectif vers Montréal depuis ce secteur",
    "l'hiver et la maison : ce qu'il faut vérifier", "les documents à préparer pour acheter",
  ],
};

// Faits vérifiés utilisables sans recherche
const FAITS = `
- Taxe de bienvenue (barème de base du Québec 2026) : 0,5 % jusqu'à 62 900 $, 1 % de 62 900 $ à 315 000 $, 1,5 % au-delà. Plusieurs villes ont un taux plus élevé au-delà de 500 000 $ (Laval : 3 %).
- Premiers acheteurs : depuis 2026, Québec rembourse jusqu'à 5 875 $ de taxe de bienvenue (crédit réduit au-delà de 750 000 $, nul à 1 M$).
- Mise de fonds minimale : 5 % jusqu'à 500 000 $ ; 10 % sur la portion de 500 000 $ à 1 499 999 $ ; 20 % à partir de 1,5 M$.
- RAP : jusqu'à 60 000 $ du REER. CELIAPP : 8 000 $ par année, 40 000 $ au total.
- Amortissement de 30 ans possible pour les premiers acheteurs (prêt assuré).
- Test de résistance : le plus élevé de 5,25 % ou du taux du contrat + 2 %.
- Vendeur représenté par un courtier : déclaration du vendeur obligatoire.
`;

export function choisirSujet(recents: { ville: string; public_cible: string; type: string }[], jour: number) {
  const villesRecentes = new Set(recents.slice(0, 18).map((r) => r.ville));
  const candidates = VILLES.filter((v) => !villesRecentes.has(v));
  const liste = candidates.length ? candidates : VILLES;
  const ville = liste[Math.floor(Math.random() * liste.length)];
  const publicCible = PUBLICS[jour % PUBLICS.length];
  const type = jour % 2 === 0 ? "conseil" : "nouveaute";
  return { ville, publicCible, type };
}

export async function genererScript(apiKey: string, sujet: { ville: string; publicCible: string; type: string }, signature: string, recentsTitres: string[]) {
  const date = new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Toronto", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const angles = [...(ANGLES[sujet.publicCible] || [])].sort(() => Math.random() - 0.5).slice(0, 3);
  const consigneType = sujet.type === "nouveaute"
    ? `Type : NOUVEAUTÉ LOCALE. Fais des recherches web sur l'actualité RÉCENTE (idéalement des 3 derniers mois) de ${sujet.ville} qui touche l'immobilier ou la vie des résidents : nouveaux projets résidentiels, transport, écoles, parcs, taxes municipales, zonage, commerces, marché immobilier local. Choisis UNE nouvelle vérifiable et explique ce qu'elle change pour les ${sujet.publicCible}.`
    : `Type : CONSEIL. Un conseil concret et utile pour les ${sujet.publicCible}, ancré à ${sujet.ville}. Choisis UN de ces angles : ${angles.join(" ; ")}. Fais une recherche web pour un fait local vérifiable à ${sujet.ville} (quartier, transport, services, marché) qui rend le conseil concret.`;
  const system =
    "Tu écris des scripts de Reels Instagram et TikTok pour Mohamed El Berhdadi, courtier immobilier résidentiel (Vendirect inc.) qui couvre Laval, la Rive-Nord jusqu'à Mirabel et Lanaudière. " +
    "Français québécois naturel, parlé, chaleureux, énergique, VOUVOIEMENT. Phrases courtes, faciles à dire face caméra. " +
    "Chiffres et faits locaux : uniquement ceux de la liste de faits fournie ou ceux trouvés dans tes recherches (avec la source). Aucune généralisation non sourcée sur les résidents ou les acheteurs d'une ville. Si tu n'es pas certain d'un fait, ne l'utilise pas. " +
    "Jamais de promesse de rendement ni de conseil financier personnalisé. Réponds à la fin UNIQUEMENT avec un objet JSON valide.";
  const user =
    `Date : ${date}.\nVille/secteur du jour : ${sujet.ville}.\nPublic du jour : ${sujet.publicCible}.\n${consigneType}\n\n` +
    `FAITS VÉRIFIÉS :${FAITS}\n` +
    `Sujets déjà traités récemment (à ne pas répéter) :\n${recentsTitres.map((t) => "- " + t).join("\n") || "- aucun"}\n\n` +
    `Rends ce JSON :\n{\n` +
    `  "titre": "sujet interne en 4 à 8 mots",\n` +
    `  "accroche": "texte à l'écran pour les 3 premières secondes, 20 à 40 caractères, sans emoji",\n` +
    `  "parties": [\n` +
    `    {"partie": "Accroche", "texte": "1 à 2 phrases choc qui arrêtent le défilement (question, chiffre, erreur à éviter)"},\n` +
    `    {"partie": "Point 1", "texte": "..."}, {"partie": "Point 2", "texte": "..."}, {"partie": "Point 3", "texte": "... (optionnel)"},\n` +
    `    {"partie": "Appel à l'action", "texte": "se présenter brièvement (Mohamed, courtier à Laval et sur la Rive-Nord) et inviter à écrire un MOT-CLÉ en message privé, ex. « Écrivez-moi ${sujet.ville.split(" ")[0].toUpperCase()} en message privé »"}\n` +
    `  ],\n` +
    `  "duree_secondes": estimation de 30 à 60,\n` +
    `  "conseils_tournage": "2 ou 3 conseils concrets : où filmer (ex. devant un parc ou une rue de ${sujet.ville}), cadrage, plans de coupe à ajouter",\n` +
    `  "legende": "légende Instagram/TikTok de 40 à 80 mots, puis une ligne vide, exactement : ${signature}, puis une ligne vide et 5 à 7 hashtags (ville, région, public)",\n` +
    `  "sources": [{"titre": "...", "url": "..."}]  // URL réellement consultées pour les faits locaux, [] si aucune\n}\n` +
    `Le texte parlé total doit faire entre 90 et 160 mots.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      thinking: { type: "disabled" },
      system,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4, user_location: { type: "approximate", city: "Laval", region: "Quebec", country: "CA", timezone: "America/Toronto" } }],
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`API Claude ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);

  // URL réellement retournées par la recherche web (pour filtrer les sources inventées)
  const urlsVues = new Set<string>();
  for (const bloc of data.content || []) {
    if (bloc.type === "web_search_tool_result" && Array.isArray(bloc.content)) {
      for (const r of bloc.content) if (r.url) urlsVues.add(r.url);
    }
  }
  const textes = (data.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text);
  const raw = textes.join("");
  const start = raw.lastIndexOf("{\n") >= 0 ? raw.indexOf("{") : raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error(`Réponse IA sans JSON (${data.stop_reason})`);
  const brut = raw.slice(start, end + 1).replace(/\/\/[^\n"]*$/gm, "");
  const s = JSON.parse(brut);
  if (!Array.isArray(s.parties) || !s.parties.length) throw new Error("Script vide");
  const sources = (Array.isArray(s.sources) ? s.sources : [])
    .filter((x: { url?: string }) => x?.url && (urlsVues.size === 0 || urlsVues.has(x.url)))
    .slice(0, 4);
  return {
    titre: String(s.titre || "").slice(0, 120),
    accroche: String(s.accroche || "").replace(/[\p{Extended_Pictographic}️]/gu, "").trim().slice(0, 60),
    parties: s.parties.map((p: { partie: string; texte: string }) => ({ partie: String(p.partie || ""), texte: String(p.texte || "").trim() })).filter((p: { texte: string }) => p.texte),
    duree_secondes: Number(s.duree_secondes) || null,
    conseils_tournage: String(s.conseils_tournage || ""),
    legende: String(s.legende || ""),
    sources,
    recherches: urlsVues.size,
  };
}
