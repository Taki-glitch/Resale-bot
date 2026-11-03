# Resale Bot

Assistant d'aide à l'achat-revente : estime la valeur de revente d'annonces de seconde main, calcule la rentabilité, classe les opportunités et alerte dans l'application.

**Les estimations ne sont jamais des bénéfices garantis. Aucun achat n'est exécuté automatiquement. Rien n'est inventé : sans données suffisantes, une annonce est « non évaluable ».**

## État : V0.3 consolidée (0.3.1)
- Saisie manuelle d'annonces (aucune collecte automatique : aucune source autorisée n'est configurée), modification, suppression sécurisée.
- Recherche, filtres (mot-clé, catégorie, marque, prix, bénéfice, marge, score, confiance, statut), tris et **recherches enregistrées** (stockées dans Supabase).
- Comparables (prix affichés ≠ ventes réalisées) avec pertinence, état, marque, modèle, taille ; estimation pondérée, « Estimation indisponible » si les données manquent.
- Calculateur complet : coûts d'acquisition, frais de plateforme, livraisons, remise en état ; scénarios prudent / central / optimiste (ce dernier seulement si les données le justifient).
- Évaluation explicable : score sur 100 (critères pondérés, recalibrables), confiance distincte du score, risques, justification, action suggérée (Acheter, À surveiller, À négocier, Ne pas acheter, Non évaluable).
- Page Opportunités (classement, filtres, historique, sélection) et notifications dans l'application dédupliquées.
- Analyse IA via une fonction Edge Supabase (identification et état ; **jamais de prix ni de statistique de demande**).

À venir : V0.4 (achats, inventaire, reventes, ventes, bénéfice réalisé). Voir `docs/ROADMAP.md`.

## Variables d'environnement
| Variable | Où | Rôle |
|---|---|---|
| `VITE_SUPABASE_URL` | secret GitHub Actions + `.env` local | URL du projet (`https://xxxx.supabase.co`, sans chemin) |
| `VITE_SUPABASE_ANON_KEY` | secret GitHub Actions + `.env` local | clé publique (la protection vient des politiques RLS) |
| `ANTHROPIC_API_KEY` | **secret Supabase uniquement** (Edge Functions → Secrets) | clé du service d'IA, jamais dans le frontend |
| `AI_MODEL` | secret Supabase (facultatif) | modèle d'IA, défaut `claude-sonnet-5-5` |

## Mise en service
1. **Supabase → SQL Editor** : exécuter dans l'ordre `supabase/migrations/0001_init.sql`, `0002_v02.sql`, `0003_v03.sql`, `0004_hardening.sql` (les migrations déjà appliquées peuvent être ignorées).
2. **Fonction IA** : Edge Functions → Deploy a new function → Via Editor, nom `analyze-listing`, coller `supabase/functions/analyze-listing/index.ts`. Ajouter le secret `ANTHROPIC_API_KEY`. Si l'appel renvoie « Invalid JWT », désactiver « Verify JWT » (la fonction vérifie elle-même l'utilisateur). **Tant qu'elle n'est pas déployée, l'analyse IA ne fonctionne pas** ; le reste de l'application fonctionne.
3. **GitHub Pages** : Settings → Pages → Source « GitHub Actions » ; secrets `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` ; le workflow `deploy.yml` teste, construit et déploie à chaque fusion sur `main`.
4. **Supabase → Authentication → URL Configuration** : Site URL `https://<utilisateur>.github.io/<dépôt>/`.

## Développement (GitHub Codespaces ou local)
```
npm ci            # ou npm install si package-lock.json est absent
npm test          # tests unitaires (Node)
npm run typecheck # TypeScript strict
npm run build     # build Vite
npm run dev
```

## Structure
```
src/core/         logique métier pure et testée (calculs, estimation, score, évaluation, recherche, notifications)
src/services/     accès Supabase
src/lib/          utilitaires (évaluation depuis la base, images, libellés)
src/components/   composants
src/pages/        écrans
supabase/         migrations SQL (ne jamais supprimer) et fonction Edge
docs/             architecture, feuille de route, tests, journal des modifications
```

## Sécurité
- RLS sur toutes les tables ; déclencheurs `enforce_same_owner` : impossible de référencer la donnée d'un autre utilisateur (migration 0004).
- Aucun secret dans le frontend. Toute suppression demande une confirmation ; un produit encore utilisé n'est jamais supprimé.
- Aucun contournement de CAPTCHA, de protections anti-robot ou de limitations des plateformes.
