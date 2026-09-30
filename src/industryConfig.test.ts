import { describe, expect, it } from "vitest";
import { industryConfig } from "./App";

const secteursAttendus = ["immobilier", "sante", "esthetique", "conciergerie"];

describe("Configuration multi-secteur (non-régression)", () => {
  it("contient bien les 4 secteurs attendus", () => {
    expect(Object.keys(industryConfig).sort()).toEqual(secteursAttendus.sort());
  });

  it("chaque secteur a exactement 3 options de projet (utilisées dans les formulaires)", () => {
    for (const secteur of secteursAttendus) {
      expect(industryConfig[secteur].projectOptions).toHaveLength(3);
    }
  });

  it("aucun libellé de secteur n'est vide", () => {
    for (const secteur of secteursAttendus) {
      const config = industryConfig[secteur];
      expect(config.roleA.length).toBeGreaterThan(0);
      expect(config.roleB.length).toBeGreaterThan(0);
      expect(config.propertiesLabel.length).toBeGreaterThan(0);
    }
  });
});
