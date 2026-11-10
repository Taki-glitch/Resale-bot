# RESALE BOT — Feuille de route

Cette feuille de route décrit l'objectif fonctionnel. Une fonctionnalité n'est considérée comme terminée que lorsque son interface, son traitement, sa persistance, ses contrôles d'erreur et ses tests sont présents.

## État général

| Version | Objectif | État |
|---|---|---|
| V0.1 | Socle, authentification, dashboard, paramètres, base et déploiement | Réalisée dans le dépôt |
| V0.2 | Saisie manuelle d'annonces, détail, analyse IA, comparables, calculateur | Validée par l'utilisateur ; reste le lockfile et le test RLS à deux comptes |
| V0.3 consolidée (0.3.1) | Évaluation explicable, opportunités, notifications, recherches enregistrées, calculateur détaillé, durcissement Supabase | Code livré (PR) ; mise en service et validation à terminer |
| V0.3.2 | Telegram, récupération via source autorisée, baisse de prix | À développer |
| V0.4 (0.4.0) | Achats, inventaire, reventes et ventes réelles | Code livré (PR) ; mise en service et validation à terminer |
| V0.5 (0.5.0) | Statistiques, maintenance planifiée, journal, sauvegarde/restauration, durcissement | Code livré (PR) ; mise en service et validation à terminer |

## V0.2 — Stabilisation (priorité immédiate)

- [x] Corriger toutes les erreurs TypeScript et obtenir un build Vite réussi.
- [ ] Figer les dépendances avec `package-lock.json` et utiliser `npm ci` dans CI.
- [ ] Vérifier que les deux migrations SQL sont appliquées au bon projet Supabase.
- [ ] Déployer la fonction `analyze-listing` et configurer sa clé IA côté serveur.
- [ ] Vérifier les politiques RLS pour chaque table utilisée par l'application.
- [x] Tester le parcours complet : saisie → enregistrement → détail → comparables → calcul.
- [ ] Vérifier le parcours d'analyse IA, avec et sans image, et les erreurs de configuration.
- [x] Vérifier que le dernier workflow GitHub Actions réussit avant de déclarer la version publiée.
- [ ] Mettre à jour le README et les captures d'écran après validation.

## V0.3 — Évaluation et opportunités

- [x] Score explicable sur 100 avec détail par critère et poids recalibrables dans les paramètres.
- [x] Niveau de confiance de l'estimation, niveau de risque et justification de chaque recommandation.
- [x] Recommandation à cinq niveaux (+ « non évaluable ») ; aucun score sans comparables suffisants.
- [x] Détection de prix anormalement élevés et d'annonces potentiellement sous-évaluées.
- [x] Page Opportunités : classement, filtres (plateforme, catégorie, budget, bénéfice, statut), tris, historique, sélection personnelle.
- [x] Statuts d'opportunité et notifications dans l'application sans répétition.
- [x] Modification d'une annonce et affichage de la provenance des informations.
- [x] Tableau de bord : meilleures opportunités et dernières annonces (données réelles).
- [x] Recherches enregistrées, filtres et tris (V0.3 consolidée).
- [x] Calculateur détaillé (livraisons, remise en état, frais de plateforme, scénarios fondés sur les données).
- [x] Migration 0004 : propriétaire des références, protection des produits, nom de recherche unique.
- [ ] Mise en service : migrations 0003 et 0004, redéploiement de la fonction IA, tests manuels et test RLS à deux comptes.

## V0.3.2 — Alertes externes et sources autorisées

- [ ] Telegram, uniquement après configuration sécurisée du bot et consentement de l'utilisateur.
- [ ] Récupération d'informations d'annonce uniquement via une source autorisée (API officielle, flux ou partenariat) ; sinon, saisie manuelle.
- [ ] Alertes de baisse de prix si une source autorisée le permet.
- [ ] Mesure de la logistique (taille, poids, fragilité) dans le score.

## V0.4 — Gestion de l'activité

- [x] Achat réel enregistré depuis une annonce (atomique), jamais d'achat automatique.
- [x] Inventaire : recherche, statuts (dont « réservé »), photos, coûts, dépenses, alerte de stock immobilisé.
- [x] Préparation de revente : prix minimum acceptable, équilibre, prix conseillé, brouillon de texte.
- [x] Ventes : encaissement réel, commission, livraison, autres coûts, bénéfice réalisé, historique.
- [x] Tableau de bord financier : chiffre d'affaires, bénéfice, marge, délai de vente, stock, performance par plateforme et catégorie.
- [x] Exports CSV et sauvegarde JSON.
- [ ] Restauration d'une sauvegarde, nettoyage des photos orphelines.
- [ ] Mise en service : migration 0005 et tests manuels (voir TESTS.md).

## V0.5 — Pilotage et automatisation maîtrisée

- [x] Statistiques : capital immobilisé, stock par ancienneté, chiffre d'affaires, frais, bénéfice réalisé, marge, objectif du mois, parcours des annonces.
- [x] Exports CSV/JSON (V0.4) et sauvegarde JSON.
- [x] Historique des changements de prix et journal d'activité.
- [x] Maintenance planifiée : verrou, isolation des erreurs, reprise, journalisation, déduplication.
- [x] Interface de connecteur de sources **autorisées** (registre vide : aucune collecte sur les plateformes).
- [x] Notifications Telegram facultatives (via la maintenance planifiée).
- [x] Restauration d'une sauvegarde (validation, aucune suppression, rejouable).
- [x] Écran d'erreur (ErrorBoundary), pages chargées à la demande, liste de contrôle de mise en production, test d'isolation SQL.
- [ ] Mise en service : migration 0006, secrets GitHub, test RLS à deux comptes, premier passage manuel de la maintenance.
- [ ] Connecteur réel : uniquement via une API, un flux ou une intégration dont l'utilisation est autorisée.
- [ ] Nettoyage des photos orphelines ; test de restauration sur un second compte.

## Critères de qualité communs

- [ ] Interface utilisable sur smartphone, tablette et ordinateur.
- [ ] États de chargement, absence de données, succès et erreur prévus.
- [ ] Aucun secret serveur dans le code client ou le dépôt.
- [ ] RLS testée avec deux comptes différents.
- [ ] Tests unitaires sur les calculs financiers et les règles de scoring.
- [ ] Build et tests obligatoires avant déploiement.
- [ ] Aucune transaction financière automatisée sans validation explicite.
