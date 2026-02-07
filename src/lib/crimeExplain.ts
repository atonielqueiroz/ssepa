export type CrimeNature = "COMUM" | "HEDIONDO" | "EQUIPARADO";
export type EquiparadoType = "TORTURA" | "TRAFICO" | "TERRORISMO";

export function explainNature(nature?: CrimeNature | null, equiparadoType?: EquiparadoType | null) {
  const n: CrimeNature = nature ?? "COMUM";

  if (n === "HEDIONDO") {
    return {
      label: "Hediondo",
      bases: ["Lei 8.072/1990 (art. 1º e parágrafo único)", "CF art. 5º, XLIII"],
    };
  }

  if (n === "EQUIPARADO") {
    const t = equiparadoType ? ` (${equiparadoType.toLowerCase()})` : "";
    return {
      label: `Equiparado a hediondo${t}`,
      bases: ["CF art. 5º, XLIII", "Lei 8.072/1990, art. 2º"],
    };
  }

  return {
    label: "Comum",
    bases: ["(sem incidência de hediondez/equiparação)"],
  };
}
