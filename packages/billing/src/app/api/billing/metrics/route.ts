import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initBilling, getProductConfig } from "@/lib/billing";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY!;
initBilling(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    // Vérifier la clé partagée
    const authHeader = req.headers.get("authorization");
    const sharedSecret = process.env.METRICS_PUSH_SECRET;
    
    if (!sharedSecret || authHeader !== `Bearer ${sharedSecret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, name, mrr, activeTenants, healthStatus } = body;

    if (!productId || !name) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    // Vérifier que le produit est configuré
    const config = await getProductConfig(productId);
    if (!config) {
      return NextResponse.json({ error: "Produit non configuré" }, { status: 404 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Upsert dans portfolio_metrics (table du control-center)
    // Note: Cette table est dans le control-center, pas ici
    // Ce endpoint est pour le control-center, pas pour le package billing
    // Mais on peut l'utiliser pour mettre à jour une table locale si besoin
    
    return NextResponse.json({ 
      success: true, 
      message: "Métriques reçues - à pousser vers control-center" 
    });
  } catch (error) {
    console.error("[Billing API] Metrics error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ error: "productId requis" }, { status: 400 });
    }

    // Retourner les métriques calculées depuis les tables locales
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (productId === "sejoura") {
      // Mode subscription_tiers : MRR = sum des abonnements actifs
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("monthly_price, status")
        .eq("status", "active");

      const mrr = (subscriptions || []).reduce((sum, s) => sum + (s.monthly_price || 0), 0);
      const activeTenants = (subscriptions || []).length;

      return NextResponse.json({
        productId,
        name: "Séjoura",
        mrr,
        activeTenants,
        healthStatus: activeTenants > 0 ? "healthy" : "unknown",
      });
    }

    if (productId === "schooly") {
      // Mode event_based : MRR basé sur inscriptions du trimestre
      const { data: ledger } = await supabase
        .from("platform_fee_ledger")
        .select("amount, status, tenant_id")
        .eq("product_id", "schooly")
        .eq("status", "collected");

      const mrr = (ledger || []).reduce((sum, l) => sum + (l.amount || 0), 0);
      const activeTenants = new Set((ledger || []).map(l => l.tenant_id)).size;

      return NextResponse.json({
        productId,
        name: "Schooly",
        mrr,
        activeTenants,
        healthStatus: activeTenants > 0 ? "healthy" : "unknown",
      });
    }

    return NextResponse.json({ error: "Produit inconnu" }, { status: 404 });
  } catch (error) {
    console.error("[Billing API] Get metrics error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
