# Resale Bot (V0.1)

Assistant d'achat-revente : estime la valeur de revente d'articles de seconde main, calcule la rentabilité, suit achats, stock et ventes.

**Les estimations ne sont jamais des bénéfices garantis.** Aucun achat n'est exécuté automatiquement.

## État : V0.3 (évaluation, opportunités, notifications)
Voir `docs/V0.3-install.md` (migration 0003), `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` et `docs/TESTS.md`.

## Historique V0.2 (import manuel, analyse IA, comparables, calculateur)
Voir `docs/V0.2-install.md` pour la mise en service (migration 0002, fonction `analyze-listing`, secret IA).

## Historique V0.1 (fondations)
Disponible : authentification, navigation (latérale sur ordinateur, barre du bas sur mobile), PWA installable, tableau de bord alimenté par la base, paramètres, schéma PostgreSQL complet avec RLS, calculs de rentabilité testés.
À venir : import et analyse IA (V0.2), opportunités et notifications (V0.3), achats et reventes (V0.4), statistiques et surveillance planifiée (V0.5).

## Sources d'annonces
Aucun connecteur automatique n'est actif. Vinted et Leboncoin ne fournissent pas d'accès public autorisé aux annonces ; le projet ne contourne ni protections, ni CAPTCHA, ni limitations. Le mode de fonctionnement prévu est l'import manuel.

## Installation (sans environnement local : GitHub Codespaces)
1. Crée un projet sur supabase.com. Dans **SQL Editor**, colle et exécute `supabase/migrations/0001_init.sql`.
2. Dans Supabase > Authentication, vérifie que l'authentification par e-mail est activée.
3. Dans GitHub > Settings > Pages, choisis **Source : GitHub Actions**.
4. Dans GitHub > Settings > Secrets and variables > Actions, ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Supabase > Project Settings > API).
5. Pousse sur `main` : le workflow lance les tests, construit et déploie.

Dans Codespaces : copie `.env.example` en `.env`, remplis les deux valeurs, puis `npm install`, `npm test`, `npm run dev`.

## Sécurité
- La clé `anon` est publique par conception ; la protection vient des politiques RLS (chaque ligne appartient à un `user_id`).
- Les secrets (IA, Telegram, service role) ne vont jamais dans le frontend : Edge Functions ou GitHub Actions secrets uniquement.

## Structure
```
src/core/        calculs purs et réglages (testés)
src/pages/       écrans
src/components/  composants
src/hooks/       accès aux données
supabase/migrations/  SQL versionné
.github/workflows/    tests et déploiement
```

## Vérifications connues
Les tests de `src/core` passent (`npm test`). Le build Vite, le typage complet et la migration SQL doivent être exécutés une première fois dans Codespaces / Supabase.
