import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";

/**
 * GET /api/school-groups
 * Returns the school group (and branches) for the current admin's establishment.
 */
export async function GET() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!profile?.establishment_id) {
    return NextResponse.json({ group: null, branches: [], stats: null });
  }

  // Fetch the establishment to get group_id
  const { data: establishment } = await supabase
    .from("establishments")
    .select("id, group_id")
    .eq("id", profile.establishment_id)
    .maybeSingle();

  if (!establishment?.group_id) {
    return NextResponse.json({ group: null, branches: [], stats: null });
  }

  // Fetch group details
  const { data: group } = await supabase
    .from("school_groups")
    .select("*")
    .eq("id", establishment.group_id)
    .maybeSingle();

  if (!group) {
    return NextResponse.json({ group: null, branches: [], stats: null });
  }

  // Fetch branches
  const { data: branchData } = await supabase
    .from("establishments")
    .select("id, name, city, branch_name, school_type, logo_url")
    .eq("group_id", establishment.group_id)
    .order("name");

  // Fetch stats per branch
  const branches = await Promise.all(
    (branchData ?? []).map(async (branch) => {
      const { count } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", branch.id);
      return { ...branch, student_count: count ?? 0 };
    })
  );

  // Aggregate stats
  const totalStudents = branches.reduce((sum, b) => sum + b.student_count, 0);

  return NextResponse.json({
    group,
    branches,
    stats: {
      group_id: group.id,
      group_name: group.name,
      branch_count: branches.length,
      total_students: totalStudents,
    },
  });
}

/**
 * POST /api/school-groups
 * Creates a new school group (the current admin becomes the super admin).
 */
export async function POST(req: NextRequest) {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Seul un admin peut créer un réseau" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, headquarters_city, logo_url } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Le nom du réseau est requis" }, { status: 400 });
  }

  // Create the group
  const { data: group, error: groupError } = await supabase
    .from("school_groups")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      headquarters_city: headquarters_city?.trim() || null,
      logo_url: logo_url || null,
      created_by: user.id,
    })
    .select("*")
    .maybeSingle();

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 500 });
  }

  // Auto-add the current establishment as the first branch
  if (profile?.establishment_id) {
    await supabase
      .from("establishments")
      .update({ group_id: group!.id })
      .eq("id", profile.establishment_id);
  }

  return NextResponse.json({ group, branches: [], stats: null });
}
