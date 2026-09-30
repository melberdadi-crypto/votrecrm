import { supabase } from "./supabase";

const BUCKET = "property-media";

function nomFichier(original: string) {
  const ext = original.includes(".") ? original.split(".").pop() : "jpg";
  const alea = Math.random().toString(36).slice(2, 9);
  return `${Date.now()}-${alea}.${ext}`;
}

export async function televerserPhoto(organizationId: string, fichier: File): Promise<string> {
  if (!supabase) throw new Error("Connexion au CRM requise.");
  const chemin = `${organizationId}/photos/${nomFichier(fichier.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, fichier, {
    cacheControl: "3600",
    upsert: false,
    contentType: fichier.type || "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);
  return data.publicUrl;
}

export async function televerserVideo(organizationId: string, blob: Blob): Promise<string> {
  if (!supabase) throw new Error("Connexion au CRM requise.");
  const chemin = `${organizationId}/videos/${nomFichier("video.mp4")}`;
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "video/mp4",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);
  return data.publicUrl;
}
