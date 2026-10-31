FICHIERS À COPIER DANS LE DÉPÔT RESALE BOT

Copier :
- docs/ARCHITECTURE.md
- docs/ROADMAP.md
- docs/TESTS.md
- supabase/config.toml

PACKAGE-LOCK.JSON
Ne pas créer ce fichier à la main : il doit être généré par npm à partir du package.json réel du dépôt. Depuis la racine du projet :

  npm install --package-lock-only

Puis vérifier :

  npm ci
  npm test
  npm run typecheck
  npm run build

Si les quatre commandes réussissent, committer package-lock.json et remplacer dans .github/workflows/deploy.yml `npm install` par `npm ci`.

ATTENTION À L'IMPORT D'ANNONCES
La V0.2 contient un formulaire d'ajout manuel dans la page Recherche d'annonces. Elle ne fait pas d'import automatique depuis Vinted ou Leboncoin. Après connexion, ouvrir directement :

  https://taki-glitch.github.io/Resale-bot/#/recherche

Puis cliquer sur « Ajouter une annonce ».

Si la page n'est pas disponible dans la version publiée, vérifier le dernier workflow GitHub Actions : un build en échec empêche la publication du nouveau code.
