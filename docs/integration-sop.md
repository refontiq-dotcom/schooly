# 📄 Fiche Mémo : Connexion d'un nouveau projet à Trouvetou

## 1. Règle d'or de l'architecture

* **Trouvetou (Vercel) :** stocke `TROUVETOU_API_KEY_PEPPER` uniquement pour calculer et vérifier les empreintes HMAC des clés entrantes. Ce pepper n'est jamais transmis aux partenaires.
* **Supabase Trouvetou :** stocke l'empreinte `HMAC-SHA256` de chaque clé partenaire.
* **Projet partenaire (Vercel) :** stocke uniquement sa clé API dédiée `TROUVETOU_API_KEY` au format `tv_live_<UUID>.<SECRET>`. Cette même clé est envoyée à Trouvetou lors des synchronisations et présentée par Trouvetou aux routes partenaires.

---

## 2. Le Secret Global (Pepper)

Le pepper reste exclusivement dans l'environnement serveur Trouvetou. Il doit être aléatoire, long, distinct de toutes les clés API partenaires et ne doit jamais apparaître dans une requête HTTP vers Schooly ou un autre partenaire.

## 3. Authentification des appels Trouvetou → partenaire

Les routes partenaires acceptent `x-trouvetou-api-key: <TROUVETOU_API_KEY>` (format recommandé). `Authorization: Bearer <TROUVETOU_API_KEY>` est conservé temporairement pour compatibilité. Elles comparent la clé dédiée en temps constant et refusent systématiquement le pepper HMAC. Ne jamais utiliser `TROUVETOU_API_KEY_PEPPER` comme jeton d'API.
