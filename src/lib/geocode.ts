// Géocodage d'adresse via Nominatim (OpenStreetMap) — gratuit, sans clé API.
// Respecte la politique d'utilisation : un seul appel à la fois, pas d'appel à chaque frappe.

export type ResultatGeocodage = { lat: number; lng: number; libelle: string };

let requeteEnCours: AbortController | null = null;

export async function geocoderAdresse(adresse: string): Promise<ResultatGeocodage | null> {
  const q = adresse.trim();
  if (q.length < 4) return null;

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
