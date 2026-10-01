import { useCallback, useState } from "react";
import { ScriptDuJour, type ReelScript } from "./ScriptDuJour";
import { MonteurReels } from "./MonteurReels";

// Page « Studio vidéo » : le script du jour (acheteurs, vendeurs, conseil, nouveauté locale) avec téléprompteur,
// puis le monteur pour monter et publier la vidéo filmée.
export function StudioReels({ connected, onVideo }: { connected: boolean; onVideo?: (blob: Blob, nom: string) => Promise<void> }) {
  const [script, setScript] = useState<ReelScript | null>(null);
  const surScript = useCallback((s: ReelScript | null) => setScript(s), []);
  return (
    <>
      <ScriptDuJour connected={connected} onScript={surScript} />
      <div style={{ marginTop: 14 }}>
        <MonteurReels publication={connected} legendeScript={script?.status !== "refuse" ? script?.legende || "" : ""} onVideo={onVideo} />
      </div>
    </>
  );
}
