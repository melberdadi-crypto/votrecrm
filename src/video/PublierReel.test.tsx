import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appels: Record<string, unknown>[] = [];
let reponses: Record<string, (body: Record<string, unknown>) => unknown> = {};

vi.mock("../lib/supabase", () => ({
  supabase: {
    functions: { invoke: async (_nom: string, { body }: { body: Record<string, unknown> }) => { appels.push(body); return { data: reponses[String(body.action)](body), error: null }; } },
    storage: { from: () => ({ uploadToSignedUrl: async () => ({ data: {}, error: null }) }) },
  },
}));

import { PublierReel } from "./PublierReel";

describe("PublierReel", () => {
  beforeEach(() => {
    appels.length = 0;
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:test", revokeObjectURL: () => {} }));
    reponses = {
      legendes: () => ({ instagram: "Texte IG www.mohamedelberhdadi.ca", facebook: "Texte FB https://www.mohamedelberhdadi.ca", instagram_actif: true, facebook_actif: true }),
      url_televersement: () => ({ path: "org/reels/a.mp4", token: "t" }),
      publier: () => ({ instagram: { creation_id: "c1" }, erreurs: { facebook: "Facebook n'autorise pas encore la publication automatique" } }),
      statut: () => ({ statut: "FINISHED" }),
      finaliser: () => ({ media_id: "m1", permalink: "https://instagram.com/reel/x" }),
    };
  });
  afterEach(() => { vi.useRealTimers(); });

  it("prépare les textes, exige la vérification, publie sur Instagram et explique l'échec Facebook", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<PublierReel blob={new Blob(["x"], { type: "video/mp4" })} texte="Bonjour, voici un conseil." onClose={() => {}} />);
    await waitFor(() => expect(screen.getByDisplayValue(/Texte IG/)).toBeInTheDocument());
    const bouton = screen.getByRole("button", { name: /Publier maintenant/ });
    expect(bouton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/J'ai regardé la vidéo en entier/));
    expect(bouton).not.toBeDisabled();
    fireEvent.click(bouton);
    await vi.advanceTimersByTimeAsync(6000);
    await waitFor(() => expect(screen.getByText(/Voir le Reel sur Instagram/)).toBeInTheDocument());
    expect(screen.getByText(/Ouvrir Meta Business Suite/)).toBeInTheDocument();
    expect(appels.map((a) => a.action)).toEqual(["legendes", "url_televersement", "publier", "statut", "finaliser"]);
    const pub = appels.find((a) => a.action === "publier")!;
    expect(pub.instagram).toBe(true);
    expect(pub.facebook).toBe(true);
    expect(String(pub.legende_instagram)).toContain("mohamedelberhdadi.ca");
  });

  it("bloque une vidéo de plus de 50 Mo", async () => {
    const lourde = { size: 60 * 1024 * 1024, type: "video/mp4" } as Blob;
    render(<PublierReel blob={lourde} texte="x" onClose={() => {}} />);
    expect(await screen.findByText(/Vidéo trop lourde/)).toBeInTheDocument();
  });
});
