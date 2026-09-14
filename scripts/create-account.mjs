#!/usr/bin/env node
/**
 * Crée un compte de démonstration dans Supabase Auth.
 *
 * Prérequis : un fichier .env.local (copié depuis .env.example) contenant :
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
 *
 * Utilisation :
 *   npm run create:account
 *   npm run create:account -- --email moi@exemple.com --password MonMotDePasse1
 *
 * Le compte est créé avec email_confirm = true : connexion immédiate, sans
 * vérification d'email. Le trigger `handle_new_user` (schema.sql) crée
 * automatiquement le profil `parent` associé.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------ */
/* Identifiants du compte de démo (surchargables en CLI)             */
/* ------------------------------------------------------------------ */

const DEMO = {
  email: "parent.demo@schooly.dev",
  password: "Demo1234!",
  fullName: "Parent Démo",
  phone: "+2250700000001",
};

// Parse simple des arguments --clé=valeur / --clé valeur
const args = process.argv.slice(2);
function argValue(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const inline = args[i + 1];
  return inline && !inline.startsWith("--") ? inline : "";
}

const email = argValue("email") || DEMO.email;
const password = argValue("password") || DEMO.password;
const fullName = argValue("name") || DEMO.fullName;
const phone = argValue("phone") || DEMO.phone;

/* ------------------------------------------------------------------ */
/* Chargement des variables d'environnement (.env.local)              */
/* ------------------------------------------------------------------ */

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const fileEnv = loadEnvFile(resolve(process.cwd(), ".env.local"));
const env = { ...fileEnv, ...process.env };

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    [
      "",
      "✗ Variables Supabase manquantes.",
      "",
      "  1. Copiez le modèle :      cp .env.example .env.local",
      "  2. Renseignez les clés depuis Supabase > Project Settings > API :",
      "       NEXT_PUBLIC_SUPABASE_URL",
      "       SUPABASE_SERVICE_ROLE_KEY",
      "  3. Relancez :              npm run create:account",
      "",
    ].join("\n")
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Création du compte via l'API admin                                 */
/* ------------------------------------------------------------------ */

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`\n→ Création du compte sur ${url}…\n`);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // connexion immédiate, pas d'email de vérification
    user_metadata: { full_name: fullName, phone },
  });

  if (error) {
    const alreadyExists =
      error.code === "422" || /already been registered|already exists/i.test(error.message);

    if (alreadyExists) {
      console.log(`⚠ Un compte existe déjà pour ${email}.`);

      // Vérifie que le mot de passe fourni fonctionne bien.
      const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? serviceRoleKey);
      const { error: signInError } = await anon.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error(
          `✗ Le mot de passe ne correspond pas au compte existant (${signInError.message}).\n` +
            `  Connectez-vous au dashboard Supabase > Authentication pour le réinitialiser.`
        );
      } else {
        console.log(`✓ Le mot de passe fourni fonctionne : connexion validée.`);
      }
      process.exit(signInError ? 1 : 0);
    }

    console.error(`✗ Échec de création : ${error.message}`);
    process.exit(1);
  }

  console.log("✓ Compte créé avec succès !\n");
  console.log("  ┌─────────────────────────────────────────────┐");
  console.log("  │  IDENTIFIANTS DE CONNEXION                  │");
  console.log("  ├─────────────────────────────────────────────┤");
  console.log(`  │  URL        : http://localhost:3000/auth`);
  console.log(`  │  Email      : ${email}`);
  console.log(`  │  Mot de passe : ${password}`);
  console.log(`  │  Nom        : ${fullName}`);
  console.log(`  │  Téléphone  : ${phone}`);
  console.log("  └─────────────────────────────────────────────┘");
  console.log(`\n  ID utilisateur : ${data.user.id}`);
  console.log("  Rôle attribué  : parent (via le trigger handle_new_user)");
  console.log("");
}

main().catch((err) => {
  console.error(`✗ Erreur inattendue : ${err.message}`);
  process.exit(1);
});
