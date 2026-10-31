# RESALE BOT — Architecture technique

**Version de référence : V0.2**  
**Application :** https://taki-glitch.github.io/Resale-bot/#/  
**Dépôt :** https://github.com/Taki-glitch/Resale-bot

## 1. Objectif

RESALE BOT est un assistant d'achat-revente. Il aide l'utilisateur à saisir manuellement des annonces, à analyser les informations disponibles, à comparer des prix et à estimer une rentabilité. Il ne réalise aucun achat ni aucune publication automatiquement.

## 2. Architecture générale

```text
Navigateur (ordinateur / mobile / tablette)
  └── React + TypeScript + Vite
       ├── Pages et composants d'interface
       ├── Modules métier purs (calculs, normalisation, estimation)
       └── Client Supabase
             ├── Supabase Auth
             ├── PostgreSQL + Row Level Security
             └── Edge Function analyze-listing
                    └── Fournisseur IA appelé côté serveur

GitHub Actions
  └── Tests → vérification TypeScript → build Vite → GitHub Pages
```

GitHub Pages héberge uniquement le frontend statique. Il ne peut pas exécuter de worker permanent ni conserver des secrets serveur. Les opérations nécessitant une clé privée doivent passer par une Edge Function ou un backend sécurisé.

## 3. Technologies

- React 18 et TypeScript pour l'interface.
- Vite pour le développement et la compilation.
- React Router avec `HashRouter`, adapté au routage sur GitHub Pages.
- Tailwind CSS pour les styles.
- Supabase Auth pour les comptes.
- PostgreSQL pour les données.
- Row Level Security (RLS) pour isoler les données de chaque utilisateur.
- Supabase Edge Functions pour les traitements serveur, dont `analyze-listing`.
- GitHub Actions pour tester, compiler et publier l'application.

Les versions exactes des dépendances doivent être figées par `package-lock.json` (voir README et ROADMAP).

## 4. Organisation du code

| Dossier | Responsabilité |
|---|---|
| `src/pages/` | Pages : tableau de bord, paramètres, recherche, détail d'annonce, calculateur, connexion |
| `src/components/` | Composants réutilisables et vues d'analyse |
| `src/core/` | Logique métier sans dépendance à l'interface : calculs, estimation, validation, réglages |
| `src/hooks/` | Hooks d'authentification, paramètres et statistiques |
| `src/services/` | Accès aux données : annonces, comparables, analyses |
| `src/lib/` | Client Supabase, gestion des erreurs et images |
| `supabase/migrations/` | Évolutions SQL versionnées |
| `supabase/functions/` | Fonctions serveur Supabase |
| `.github/workflows/` | Automatisation des tests et du déploiement |
| `docs/` | Documentation technique, feuille de route et plan de tests |

## 5. Parcours fonctionnel V0.2

1. L'utilisateur se connecte.
2. Il ouvre **Recherche d'annonces**.
3. Il choisit **Ajouter une annonce** et saisit les informations connues : plateforme, URL, prix, titre, état, localisation, marque, modèle, catégorie et description.
4. L'application enregistre la fiche dans Supabase et détecte les doublons.
5. Depuis la fiche, l'utilisateur peut lancer l'analyse IA si la fonction serveur est déployée et configurée.
6. Il ajoute manuellement des comparables, en distinguant prix affichés et ventes réalisées.
7. Le moteur estime une valeur de revente et le calculateur présente les scénarios et la rentabilité.

**Limite importante :** le lien Vinted/Leboncoin est conservé comme référence ; le frontend ne visite pas automatiquement l'annonce et ne récupère pas son contenu. Les données doivent être saisies par l'utilisateur. Aucun connecteur automatique n'est configuré.

## 6. Données et sécurité

- Les montants sont stockés en centimes entiers pour éviter les erreurs d'arrondi.
- Les dates sont stockées en `timestamptz` (UTC).
- Les identifiants métier sont des UUID.
- Les tables contenant des données utilisateur doivent être protégées par RLS.
- Le navigateur ne doit jamais recevoir de clé `service_role`, de clé IA ou de secret Telegram.
- La clé Supabase `anon`/publishable peut être utilisée dans le frontend ; la sécurité repose sur les politiques RLS.
- Toute analyse IA doit être exécutée côté serveur et vérifier l'identité de l'utilisateur.

## 7. Variables et secrets

Frontend (variables de build GitHub Actions ou fichier `.env` local) :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Serveur Supabase (secrets de la fonction) :

- `ANTHROPIC_API_KEY` ou la clé du fournisseur IA effectivement utilisé par le code de la fonction.

Ne jamais préfixer un secret serveur par `VITE_`. Ne jamais committer un vrai fichier `.env`.

## 8. Migrations et déploiement

Les migrations SQL sont appliquées dans l'ordre numérique :

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_v02.sql`

La fonction `analyze-listing` doit être déployée séparément avec la Supabase CLI et ses secrets configurés. Le simple fait que ses fichiers soient dans GitHub ne signifie pas qu'elle est déployée.

Le déploiement du frontend est déclenché par GitHub Actions. Un commit ne sera publié que si les tests et le build réussissent.

## 9. Principes d'évolution

- Garder les calculs métier dans `src/core/` et les couvrir par des tests.
- Séparer l'interface, les services de données et les traitements serveur.
- Ne pas ajouter de scraping ni contourner les protections des plateformes.
- Demander une validation humaine avant tout achat, paiement ou publication.
- Ajouter une migration SQL pour toute modification du schéma existant.
