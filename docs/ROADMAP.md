# RESALE BOT — Feuille de route

Cette feuille de route décrit l'objectif fonctionnel. Une fonctionnalité n'est considérée comme terminée que lorsque son interface, son traitement, sa persistance, ses contrôles d'erreur et ses tests sont présents.

## État général

| Version | Objectif | État |
|---|---|---|
| V0.1 | Socle, authentification, dashboard, paramètres, base et déploiement | Réalisée dans le dépôt |
| V0.2 | Saisie manuelle d'annonces, détail, analyse IA, comparables, calculateur | Code intégré ; mise en service et validation à terminer |
| V0.3 | Opportunités, recherches sauvegardées, filtres, score et alertes | À développer |
| V0.4 | Achats, inventaire, reventes et ventes réelles | À développer |
| V0.5 | Veille planifiée autorisée, statistiques, exports et durcissement | À développer |

## V0.2 — Stabilisation (priorité immédiate)

- [ ] Corriger toutes les erreurs TypeScript et obtenir un build Vite réussi.
- [ ] Figer les dépendances avec `package-lock.json` et utiliser `npm ci` dans CI.
- [ ] Vérifier que les deux migrations SQL sont appliquées au bon projet Supabase.
- [ ] Déployer la fonction `analyze-listing` et configurer sa clé IA côté serveur.
- [ ] Vérifier les politiques RLS pour chaque table utilisée par l'application.
- [ ] Tester le parcours complet : saisie → enregistrement → détail → comparables → calcul.
- [ ] Vérifier le parcours d'analyse IA, avec et sans image, et les erreurs de configuration.
- [ ] Vérifier que le dernier workflow GitHub Actions réussit avant de déclarer la version publiée.
- [ ] Mettre à jour le README et les captures d'écran après validation.

## V0.3 — Détection et qualification des opportunités

- [ ] Créer des recherches enregistrées par plateforme, catégorie, marque, mots-clés, budget et localisation.
- [ ] Ajouter des filtres sur les annonces déjà importées.
- [ ] Calculer un score explicable sur 100 : marge potentielle, demande, facilité de revente, fiabilité des données, état et logistique.
- [ ] Afficher le niveau de confiance et les données manquantes ; ne pas attribuer un score élevé sans comparables suffisants.
- [ ] Construire une liste d'opportunités triable.
- [ ] Ajouter des notifications dans l'application.
- [ ] Ajouter Telegram uniquement après configuration sécurisée du bot et consentement de l'utilisateur.

## V0.4 — Gestion de l'activité

- [ ] Transformer une opportunité en achat confirmé, après validation humaine.
- [ ] Enregistrer le prix payé, les frais, le transport, la date et le vendeur/source.
- [ ] Gérer les états du stock : à recevoir, reçu, à préparer, en vente, vendu, retourné, abandonné.
- [ ] Préparer un titre, une description et un prix de revente suggérés.
- [ ] Enregistrer le prix de vente réel et tous les coûts associés.
- [ ] Calculer le bénéfice réellement réalisé, distinct du bénéfice estimé.

## V0.5 — Pilotage et automatisation maîtrisée

- [ ] Tableau de bord financier : capital immobilisé, stock, chiffre d'affaires, frais, bénéfice réalisé et marge.
- [ ] Exports CSV/JSON.
- [ ] Historique des changements de prix et journal d'activité.
- [ ] Surveillance planifiée uniquement via API, flux ou intégrations dont l'utilisation est autorisée.
- [ ] Déduplication, limites de fréquence, reprise sur erreur et journalisation des tâches.
- [ ] Sauvegarde et procédure de restauration testée.

## Critères de qualité communs

- [ ] Interface utilisable sur smartphone, tablette et ordinateur.
- [ ] États de chargement, absence de données, succès et erreur prévus.
- [ ] Aucun secret serveur dans le code client ou le dépôt.
- [ ] RLS testée avec deux comptes différents.
- [ ] Tests unitaires sur les calculs financiers et les règles de scoring.
- [ ] Build et tests obligatoires avant déploiement.
- [ ] Aucune transaction financière automatisée sans validation explicite.
