# 📄 Fiche Mémo : Connexion d'un nouveau projet à Trouvetou

## 1. Règle d'or de l'architecture

* **Trouvetou (Vercel) :** stocke `TROUVETOU_API_KEY_PEPPER` uniquement pour calculer et vérifier les empreintes HMAC des clés entrantes. Ce pepper n'est jamais transmis aux partenaires.
* **Supabase Trouvetou :** stocke l'empreinte `HMAC-SHA256` de chaque clé partenaire.
* **Projet partenaire (Vercel) :** stocke sa clé API `TROUVETOU_API_KEY` au format `tv_live_<UUID>.<SECRET>` pour les synchronisations, ainsi qu'un secret de réservation dédié `TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET`. Les deux valeurs ont des usages distincts.

---

## 2. Le Secret Global (Pepper)

Le pepper reste exclusivement dans l'environnement serveur Trouvetou. Il doit être aléatoire, long, distinct de toutes les clés API partenaires et ne doit jamais apparaître dans une requête HTTP vers Schooly ou un autre partenaire.

## 3. Authentification des appels Trouvetou → partenaire

Les appels Schooly → Trouvetou (synchronisation) utilisent `x-trouvetou-api-key: <TROUVETOU_API_KEY>`. Les appels Trouvetou → Schooly (réservation) utilisent `x-trouvetou-booking-secret: <TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET>`. Ces deux secrets sont distincts. Les routes comparent les secrets en temps constant et refusent systématiquement le pepper HMAC. Ne jamais utiliser `TROUVETOU_API_KEY_PEPPER` comme jeton d'API.
