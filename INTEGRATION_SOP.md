# 📄 Fiche Mémo : Connexion d'un nouveau projet à Trouvetou

## 1. Règle d'or de l'architecture

* **Trouvetou (Vercel) :** Ne stocke que la variable globale `TROUVETOU_API_KEY_PEPPER`. Il n'a **jamais** besoin de connaître les clés des clients.
* **Supabase :** Stocke l'empreinte `HMAC-SHA256` générée à partir du Pepper global et de la clé du client.
* **Projet Client (Vercel) :** Stocke sa propre clé unique `TROUVETOU_API_KEY` au format `tv_live_<UUID>.<SECRET>`.

---

## 2. Le Secret Global (Pepper)

À conserver en lieu sûr (identique pour tout l'écosystème Trouvetou) :
```env
TROUVETOU_API_KEY_PEPPER=asdertfyuhnhgftredseokiujhytgf25
```