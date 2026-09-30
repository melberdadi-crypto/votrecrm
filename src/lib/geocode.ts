// Géocodage d'adresse via Nominatim (OpenStreetMap) — gratuit, sans clé API.
// Respecte la politique d'utilisation : un seul appel à la fois, pas d'appel à chaque frappe.

export type ResultatGeocodage = { lat: number; lng: number; libelle: string; approximatif?: boolean };

let requeteEnCours: AbortController | null = null;

async function interroger(q: string): Promise<{ lat: number; lng: number; libelle: string } | null> {
  requeteEnCours?.abort();
  const controller = new AbortController();
  requeteEnCours = controller;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!data.length) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon), libelle: data[0].display_name };
  } catch {
    return null;
  } finally {
    if (requeteEnCours === controller) requeteEnCours = null;
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Essaie l'adresse complète, puis — si introuvable (fréquent pour un lieu-dit ou un
// douar rural absent d'OpenStreetMap) — réessaie avec des segments de plus en plus
// larges (en retirant le début) pour au moins localiser la ville/région/pays.
export async function geocoderAdresse(adresse: string): Promise<ResultatGeocodage | null> {
  const q = adresse.trim();
  if (q.length < 4) return null;

  const segments = q.split(",").map((s) => s.trim()).filter(Boolean);
  if (segments.length <= 1) {
    const resultat = await interroger(q);
    return resultat ? { ...resultat, approximatif: false } : null;
  }

  for (let debut = 0; debut < segments.length - 1; debut++) {
    const requete = segments.slice(debut).join(", ");
    const resultat = await interroger(requete);
    if (resultat) return { ...resultat, approximatif: debut > 0 };
    if (debut < segments.length - 2) await pause(400);
  }
  return null;
}
