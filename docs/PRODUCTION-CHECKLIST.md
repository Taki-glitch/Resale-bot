# Mise en production : liste de contrôle

À dérouler avant chaque fusion dans `main` (qui déclenche le déploiement GitHub Pages). Ne cocher une case qu'après l'avoir réellement vérifiée.

## 1. Avant de fusionner
- [ ] Le workflow « CI (pull request) » est **vert** (tests, typecheck, build).
- [ ] Une **sauvegarde JSON** récente a été téléchargée (Paramètres → Sauvegarde et restauration).
- [ ] Les migrations nouvelles ont été relues puis exécutées **dans l'ordre** dans le SQL Editor (0001 → 0006). Elles sont additives : aucune ne supprime de donnée.
- [ ] Si la fonction Edge `analyze-listing` a changé : redéployée, secrets `ANTHROPIC_API_KEY` (et `AI_MODEL` si utilisé) présents.
- [ ] Secrets GitHub : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ; pour la tâche planifiée `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ `TELEGRAM_BOT_TOKEN`, variable `APP_URL`). La clé « service » n'est **jamais** copiée dans le frontend ni dans le code.

## 2. Isolation des données (deux comptes)
- [ ] Exécuter `supabase/tests/rls_two_accounts.sql` : le résultat attendu est le message « TEST TERMINÉ : tous les contrôles sont OK ».
- [ ] Contrôles SQL de `docs/TESTS.md` (section 6 ter) : aucune table sans RLS, 11 déclencheurs `trg_same_owner`.

## 3. Après le déploiement
- [ ] Ouvrir le site en navigation privée : écran de connexion, aucune erreur de console.
- [ ] Parcours complet : annonce → comparables → évaluation → achat → vente → statistiques (`docs/TESTS.md`).
- [ ] Lancer la maintenance à la main (Actions → « Maintenance planifiée » → Run workflow) puis vérifier la page **Journal**.
- [ ] Installer l'application sur l'écran d'accueil (iPhone) et vérifier le chargement après mise à jour (vider l'ancien cache si besoin).

## 4. Retour arrière
- Code : « Revert » de la pull request dans GitHub, puis nouveau déploiement automatique. Les migrations étant additives, le code précédent reste compatible avec la base.
- Données : restauration depuis la sauvegarde JSON (Paramètres) ; elle n'efface rien et peut être rejouée.

## 5. Surveillance
- Onglet Actions : une exécution rouge de « Maintenance planifiée » signale une erreur ; le détail est dans le **Journal** (statut « Erreur ») ; le prochain passage rejoue le traitement.
- GitHub suspend les workflows planifiés après 60 jours sans activité sur le dépôt : les relancer manuellement.
- Coût IA : fixer une limite de dépenses sur la console du fournisseur ; la fonction limite à 20 analyses par heure.
