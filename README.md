# RESALE BOT — V0.3 candidate

Assistant d’aide à l’achat-revente : suivi des annonces, estimation, rentabilité et qualification des opportunités. Les décisions d’achat, les transactions et les publications restent manuelles.

## Statut de cette livraison
La V0.3 ajoute les filtres sur les annonces déjà enregistrées, les recherches sauvegardées, le score d’opportunité, le classement et les notifications internes. Voir `docs/V0.3-PR.md` pour les limites et la procédure d’intégration.

L’analyse IA dépend toujours du déploiement séparé de `supabase/functions/analyze-listing`. Cette livraison ne déploie pas automatiquement cette fonction.

## Mode semi-automatique
La V0.3 automatise le filtrage des annonces déjà présentes, leur qualification à la demande et les alertes internes. Elle ne collecte pas automatiquement les nouvelles annonces Vinted/Leboncoin. Une surveillance planifiée ne sera ajoutée qu'avec une API ou une source autorisée, sans contournement de protections, CAPTCHA ou limitations.

## Installation et validation
1. Appliquer les migrations `0001_init.sql`, `0002_v02.sql` puis `0003_v03.sql` dans Supabase.
2. Configurer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` pour le frontend.
3. Installer les dépendances avec `npm install`.
4. Exécuter `npm test`, `npm run typecheck` et `npm run build`.
5. Déployer le frontend via GitHub Actions.

Les secrets IA et Telegram ne doivent jamais être intégrés au frontend.
