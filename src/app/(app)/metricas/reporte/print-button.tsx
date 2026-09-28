"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="btn-primary btn-sm" onClick={() => window.print()}>
      <Printer className="size-4" /> Imprimir o guardar PDF
    </button>
  );
}
