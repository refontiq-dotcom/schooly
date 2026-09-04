import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/establishments/[id]/modalities
 * Récupère les modalités d'inscription actives d'un établissement.
 * Utilisé par le formulaire de réservation pour afficher les options disponibles.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "ID de l'établissement manquant" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: modalities, error } = await supabase
    .from("inscription_modalities")
    .select("*")
    .eq("establishment_id", id)
    .eq("is_active", true)
    .order("modality");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si aucune modalité configurée, retourner les modalités par défaut
  if (!modalities || modalities.length === 0) {
    const defaultModalities = [
      {
        id: "default",
        establishment_id: id,
        modality: "standard",
        name: "Inscription standard",
        description: "Inscription avec frais de scolarité complets",
        fee_multiplier: 1.0,
        required_documents: [
          "acte_naissance",
          "photo_identite",
          "bulletin_precedent",
        ],
        is_active: true,
      },
    ];
    return NextResponse.json({ modalities: defaultModalities });
  }

  return NextResponse.json({ modalities });
}
