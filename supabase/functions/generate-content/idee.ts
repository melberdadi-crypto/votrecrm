// Idée de publication du jour (Facebook + Instagram), pour deux marchés : le Québec (Laval) et le Maroc.

export type Marche = "quebec" | "maroc";
export const MARCHES: Marche[] = ["quebec", "maroc"];
export const estMarche = (m: unknown): m is Marche => m === "quebec" || m === "maroc";

// Numéro à afficher sur toutes les publications destinées au Maroc
export const TEL_MAROC = "+212 664 908 900";
export const WHATSAPP_MAROC = "https://wa.me/212664908900";
export const VILLES_MAROC = ["Casablanca", "Marrakech", "El Jadida", "Mohammedia", "Rabat", "Tanger"];

// Faits vérifiés que l'IA peut citer (jamais d'autres chiffres)
export const FAITS = `
- Taxe de bienvenue à Laval en 2026 : 0,5 % jusqu'à 62 900 $, 1 % de 62 900 $ à 315 000 $, 1,5 % de 315 000 $ à 500 000 $, 3 % au-delà de 500 000 $.
- Exemples Laval 2026 : 400 000 $ → 4 110,50 $ ; 600 000 $ → 8 610,50 $ ; 800 000 $ → 14 610,50 $.
- Depuis 2026, Québec rembourse aux premiers acheteurs jusqu'à 5 875 $ de taxe de bienvenue (100 % des premiers 5 000 $ + 25 % des 3 500 $ suivants), crédit réduit au-delà de 750 000 $ et nul à 1 M$. Condition : ni vous ni votre conjoint propriétaire d'une habitation occupée dans les 4 dernières années civiles.
- Mise de fonds minimale : 5 % jusqu'à 500 000 $ ; 5 % des premiers 500 000 $ + 10 % du reste jusqu'à 1 499 999 $ ; 20 % à partir de 1,5 M$.
- RAP : jusqu'à 60 000 $ du REER, remboursable sur 15 ans. CELIAPP : 8 000 $ par année, 40 000 $ au total, retrait non imposable pour un premier achat.
- Amortissement de 30 ans possible pour les premiers acheteurs (prêt assuré) depuis décembre 2024.
- Test de résistance : qualification au plus élevé de 5,25 % ou du taux du contrat + 2 %.
- Marché de Laval, août 2026 (APCIQ) : prix médian unifamiliale 642 750 $ (+7 % sur un an), copropriété 449 000 $ (+8 %), environ 10 % plus de propriétés à vendre qu'un an plus tôt.
- Quartiers de Laval : Laval-des-Rapides et Pont-Viau (métro Cartier, De la Concorde, Montmorency), Chomedey (Carrefour Laval, Centropolis, Place Bell), Sainte-Dorothée, Laval-Ouest, Laval-sur-le-Lac (ouest, nature), Sainte-Rose (vieux village, parc de la Rivière-des-Mille-Îles, gare exo), Vimont, Auteuil, Fabreville (familial), Duvernay, Saint-Vincent-de-Paul, Saint-François (est, plus d'espace, Centre de la nature).
- Déclaration du vendeur obligatoire quand le vendeur est représenté par un courtier. Promesse d'achat avec conditions (financement, inspection, documents du syndicat pour un condo).
`;

// Maroc : ordres de grandeur prudents, toujours « à confirmer auprès du notaire ». Aucun prix au m² (non vérifié).
export const FAITS_MAROC = `
- Frais d'acquisition d'un logement au Maroc, à la charge de l'acheteur (ordres de grandeur, à confirmer auprès du notaire) : droits d'enregistrement d'environ 4 %, conservation foncière d'environ 1,5 %, honoraires du notaire d'environ 1 à 1,5 %. Total indicatif : environ 6,5 à 7 % du prix, hors frais d'hypothèque en cas de crédit.
- Côté vendeur : la taxe sur les profits immobiliers (TPI) est de 20 % du profit, avec un minimum de 3 % du prix de vente. Des exonérations existent, notamment pour la résidence principale sous conditions de durée d'occupation : à valider avec le notaire avant de vendre.
- Aide directe au logement « Daam Sakane » (programme 2024-2028) : 100 000 DH pour un logement jusqu'à 300 000 DH TTC, 70 000 DH pour un logement de 300 000 à 700 000 DH TTC. Pour les Marocains, résidents ou MRE, qui ne sont pas déjà propriétaires d'un logement et n'ont jamais reçu d'aide au logement de l'État ; logement neuf en première vente (permis d'habiter délivré à partir du 1er janvier 2023), résidence principale pendant 5 ans. Demande sur daamsakane.ma AVANT de signer le compromis.
- Titre foncier : avant tout engagement, demander le certificat de propriété à la conservation foncière (ANCFCC) pour vérifier le propriétaire, les hypothèques et les charges. Un bien non titré (melkia) demande plus de vérifications et de démarches.
- Achat sur plan (VEFA) : encadré par la loi 107-12 (contrat écrit, échéancier de paiement, garanties). Toujours passer par un notaire.
- MRE : financer l'achat avec des devises transférées de l'étranger (compte en dirhams convertibles) et conserver les justificatifs bancaires facilite le retransfert du produit de la vente plus tard. Une procuration permet de signer sans se déplacer.
- Villes couvertes : Casablanca (capitale économique), Rabat (capitale administrative), Marrakech (ville touristique, résidences secondaires), Tanger (port Tanger Med, train à grande vitesse Al Boraq vers Rabat et Casablanca), Mohammedia (ville côtière entre Casablanca et Rabat), El Jadida (côte atlantique au sud de Casablanca, près du pôle industriel de Jorf Lasfar).
`;

const PAGES = `
- https://mohamedelberhdadi.ca/conseils/taxe-de-bienvenue-laval-2026
- https://mohamedelberhdadi.ca/conseils/premier-achat-quebec-etapes
- https://mohamedelberhdadi.ca/conseils/acheter-a-laval-guide-des-quartiers
- https://mohamedelberhdadi.ca/calculateur-hypothecaire
- https://mohamedelberhdadi.ca/calculateur-taxe-bienvenue
- https://mohamedelberhdadi.ca/communautes
- https://mohamedelberhdadi.ca (formulaires acheteur et vendeur, évaluation gratuite)
`;

const FORMATS = [
  "conseil pratique pour acheteurs",
  "conseil pratique pour vendeurs",
  "mythe ou réalité",
  "portrait d'un quartier de Laval",
  "calcul concret avec des chiffres",
  "liste de vérification (3 à 5 points)",
  "question à la communauté pour susciter des commentaires",
  "erreur fréquente à éviter",
  "saison et calendrier immobilier",
];

const FORMATS_MAROC = [
  "conseil pratique pour acheter un bien",
  "conseil pratique pour vendre un bien",
  "conseil pour les Marocains du monde (MRE) qui achètent ou vendent à distance",
  "mythe ou réalité",
  "portrait de la ville : pourquoi y acheter, pour quel mode de vie",
  "calcul concret des frais d'acquisition avec des chiffres",
  "liste de vérification avant de signer (3 à 5 points)",
  "question à la communauté pour susciter des commentaires",
  "erreur fréquente à éviter",
  "les étapes d'un achat ou d'une vente, du compromis à l'acte définitif",
];

export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

const auHasard = <T>(liste: T[]) => liste[Math.floor(Math.random() * liste.length)];

function consignes(marche: Marche, date: string, recents: string[], signature: string) {
  const dejaPublies = `Sujets déjà publiés récemment (à NE PAS répéter) :\n${recents.map((r) => "- " + r).join("\n") || "- aucun"}\n\n`;
  const debutJson =
    `Rends ce JSON :\n{\n` +
    `  "theme": "sujet en 3 à 6 mots",\n`;
  const visuel =
    `  "titre_visuel": "accroche pour l'image, 35 à 70 caractères, percutante, SANS emoji",\n` +
    `  "sous_titre": "une phrase de 60 à 110 caractères qui complète l'accroche, SANS emoji",\n`;

  if (marche === "maroc") {
    const ville = auHasard(VILLES_MAROC);
    return {
      system:
        "Tu es le responsable des réseaux sociaux de Mohamed El Berhdadi, qui accompagne les acheteurs et les vendeurs de biens immobiliers au Maroc " +
        `(${VILLES_MAROC.join(", ")}), y compris les Marocains du monde (MRE). ` +
        "Tu écris en français clair et courant, tel qu'on l'écrit au Maroc (pas de tournures québécoises), ton chaleureux, professionnel et concret, sans jargon. Tu VOUVOIES toujours le lecteur. " +
        "Les montants sont en dirhams (DH). Tu n'utilises QUE les chiffres de la liste de faits fournie, présentés comme des ordres de grandeur à confirmer auprès du notaire ; aucun prix au mètre carré, aucun prix de quartier. " +
        "Tu ne présentes jamais Mohamed comme courtier, notaire ou conseiller fiscal au Maroc, et tu ne mentionnes ni le Québec ni Vendirect. Jamais de promesse de rendement ni de conseil financier ou fiscal personnalisé. " +
        "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.",
      user:
        `Date : ${date}. Format demandé aujourd'hui : ${auHasard(FORMATS_MAROC)}.\nVille du jour : ${ville}.\n` +
        `Tiens compte du calendrier marocain quand c'est pertinent (retour des MRE en été, rentrée, fin d'année).\n\n` +
        `FAITS VÉRIFIÉS :${FAITS_MAROC}\n` + dejaPublies + debutJson +
        `  "kicker": "catégorie en 1 à 3 mots (ex. Acheter au Maroc, Vendre, MRE, ${ville})",\n` + visuel +
        `  "texte_facebook": "publication Facebook de 60 à 130 mots, emojis avec modération, se termine par un appel à l'action invitant à appeler ou à écrire sur WhatsApp au ${TEL_MAROC}, avec ce lien : ${WHATSAPP_MAROC}, puis une ligne vide et exactement : ${signature}",\n` +
        `  "texte_instagram": "légende Instagram de 50 à 110 mots, sans lien cliquable, se termine par un appel à l'action invitant à écrire sur WhatsApp au ${TEL_MAROC}, puis une ligne vide, exactement : ${signature}, puis une ligne vide et 4 à 6 hashtags pertinents (#ImmobilierMaroc, #${ville.replace(/\s/g, "")}, #MRE, etc.)"\n}`,
    };
  }
  return {
    system:
      "Tu es le responsable des réseaux sociaux de Mohamed El Berhdadi, courtier immobilier résidentiel à Laval (Vendirect inc.). " +
      "Tu écris en français québécois, ton chaleureux, professionnel et concret, sans jargon. Tu VOUVOIES toujours le lecteur, jamais de tutoiement. " +
      "Tu n'utilises QUE les chiffres de la liste de faits fournie ; si tu n'as pas de chiffre vérifié, n'en mets pas. Jamais de promesse de rendement ni de conseil financier personnalisé. " +
      "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.",
    user:
      `Date : ${date}. Format demandé aujourd'hui : ${auHasard(FORMATS)}.\n` +
      `Tiens compte de la saison et du calendrier (rentrée, impôts, déménagements du 1er juillet, fêtes, printemps = forte période de ventes).\n\n` +
      `FAITS VÉRIFIÉS :${FAITS}\nPAGES DU SITE (pour le lien Facebook) :${PAGES}\n` + dejaPublies + debutJson +
      `  "kicker": "catégorie en 1 à 3 mots (ex. Premier achat, Vendre, Quartiers, Financement)",\n` + visuel +
      `  "texte_facebook": "publication Facebook de 60 à 130 mots, emojis avec modération, se termine par un appel à l'action et UN lien pertinent de la liste, puis une ligne vide et exactement : ${signature}",\n` +
      `  "texte_instagram": "légende Instagram de 50 à 110 mots, sans lien cliquable (écrire « lien dans la bio »), puis une ligne vide, exactement : ${signature}, puis une ligne vide et 4 à 6 hashtags pertinents (#Laval, #ImmobilierLaval, etc.)"\n}`,
  };
}

// Garantit que le numéro marocain figure dans un texte destiné au Maroc (avant les hashtags s'il y en a)
export function avecNumeroMaroc(texte: string, signature: string) {
  if (texte.replace(/[\s.\-]/g, "").includes("212664908900")) return texte;
  const ligne = signature.replace(/[\s.\-]/g, "").includes("212664908900") ? signature : `WhatsApp / Tél. : ${TEL_MAROC}`;
  const m = texte.match(/\n\s*(#\S+(\s+#\S+)*)\s*$/);
  return m ? `${texte.slice(0, m.index).trimEnd()}\n\n${ligne}\n\n${m[1]}` : `${texte.trimEnd()}\n\n${ligne}`;
}

// L'IA met parfois de vrais retours à la ligne dans les chaînes JSON : on les échappe avant JSON.parse
export function parseJsonSouple(brut: string) {
  let sortie = "", dansChaine = false, echappe = false;
  for (const c of brut) {
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

export async function genererIdee(apiKey: string, recents: string[], signature: string, marche: Marche = "quebec") {
  const date = new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Toronto", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const { system, user } = consignes(marche, date, recents, signature);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 3000, thinking: { type: "disabled" }, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`API Claude ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const raw = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error(`Réponse IA sans JSON (${data.stop_reason}, ${(data.content || []).map((c: { type: string }) => c.type).join("+")})`);
  const idee = parseJsonSouple(raw.slice(start, end + 1));
  for (const k of ["theme", "kicker", "titre_visuel", "sous_titre", "texte_facebook", "texte_instagram"]) {
    if (typeof idee[k] !== "string" || !idee[k].trim()) throw new Error(`Champ manquant : ${k}`);
  }
  // Les polices du visuel n'ont pas d'emojis : on les retire des textes de l'image
  const sansEmoji = (t: string) => t.replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s{2,}/g, " ").trim();
  for (const k of ["kicker", "titre_visuel", "sous_titre"]) idee[k] = sansEmoji(idee[k]);
  if (marche === "maroc") for (const k of ["texte_facebook", "texte_instagram"]) idee[k] = avecNumeroMaroc(idee[k], signature);
  return idee as Record<string, string>;
}
