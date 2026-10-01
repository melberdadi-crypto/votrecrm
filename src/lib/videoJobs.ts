import { supabase } from "./supabase";

export type VideoJobRow = {
  id: string;
  organization_id: string;
  property_id: string | null;
  statut: "nouveau" | "en_cours" | "en_validation" | "valide" | "rendu" | "termine" | "erreur";
  video_brute_path: string | null;
  video_finale_url: string | null;
  transcript: { chunks?: { text: string; timestamp: [number, number] }[] } | null;
  plan: { ev?: { t: string; main?: string; txt?: string; items?: string[]; lines?: string[] }[]; caps?: { txt: string }[] } | null;
  erreur: string | null;
  created_at: string;
  updated_at: string;
};

export async function creerJobVideo(organizationId: string, propertyId: string | null, cheminVideoBrute: string): Promise<VideoJobRow> {
  if (!supabase) throw new Error("Connexion au CRM requise.");
  const { data, error } = await supabase
    .from("video_jobs")
    .insert({ organization_id: organizationId, property_id: propertyId, video_brute_path: cheminVideoBrute, statut: "nouveau" })
    .select()
    .single();
  if (error) throw error;
  return data as VideoJobRow;
}

export async function lireJobVideo(id: string): Promise<VideoJobRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("video_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as VideoJobRow | null;
}

export async function validerJobVideo(id: string): Promise<void> {
  if (!supabase) throw new Error("Connexion au CRM requise.");
  const { error } = await supabase.from("video_jobs").update({ statut: "valide" }).eq("id", id);
  if (error) throw error;
}

// Nom lisible pour chaque type d'évènement détecté, pour l'écran de validation.
export const LIBELLES_EVENEMENTS: Record<string, string> = {
  statRouge: "Chiffre mis en avant",
  statBlanc: "Chiffre",
  montant: "Montant affiché",
  list: "Liste d'étiquettes",
  section: "Nouvelle section",
  cta: "Appel à l'action (fin)",
  name: "Carton avec ton nom",
  leak: "Transition (fuite de lumière)",
  emoji: "Emoji",
  highlight: "Mot surligné",
};
