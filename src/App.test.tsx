import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App — rendu de base (non-régression)", () => {
  it("s'affiche sans planter (mode démonstration, aucune session)", () => {
    render(<App />);
    // La barre de navigation principale doit toujours être présente
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("Automatisations")).toBeInTheDocument();
    expect(screen.getByText("Équipe")).toBeInTheDocument();
  });

  it("n'affiche qu'un seul bouton « Paramètres »", () => {
    render(<App />);
    const parametresButtons = screen.getAllByText("Paramètres");
    expect(parametresButtons).toHaveLength(1);
  });
});
