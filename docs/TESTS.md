# RESALE BOT — Plan de tests

## 1. Commandes locales

À exécuter depuis la racine du dépôt, avec Node.js conforme à la version minimale indiquée dans `package.json` :

```bash
npm ci
npm test
npm run typecheck
npm run build
```

`npm ci` nécessite un `package-lock.json` cohérent avec `package.json`. Tant que ce fichier n'est pas généré, utiliser temporairement `npm install`, puis créer et committer le lockfile.

## 2. Tests automatisés existants

Les tests présents dans `src/core/*.test.ts` couvrent notamment :

- estimation à partir de comparables ;
- priorité aux ventes réalisées lorsque suffisamment de données existent ;
- avertissement lorsque l'estimation repose sur des prix affichés ;
- parsing et formatage des montants en euros ;
- reconnaissance et normalisation des URL Vinted et Leboncoin ;
- détection de doublons ;
- calcul des frais, bénéfices, marges, rendements et prix d'achat maximal ;
- scénarios prudent, réaliste et optimiste ;
- chargement des paramètres par défaut et fusion des paramètres partiels.

Les tests métier ne remplacent pas les tests d'intégration avec Supabase.

## 3. Tests manuels — authentification

- [ ] Créer un compte de test.
- [ ] Vérifier le comportement de confirmation d'e-mail selon la configuration Supabase.
- [ ] Se connecter, actualiser la page et vérifier que la session est conservée.
- [ ] Se déconnecter et vérifier le retour à l'écran de connexion.
- [ ] Vérifier qu'un utilisateur non connecté ne peut pas ouvrir les pages protégées.

## 4. Tests manuels — paramètres et dashboard

- [ ] Modifier chaque valeur financière et enregistrer.
- [ ] Actualiser la page et vérifier la persistance.
- [ ] Vérifier les frais en pourcentage et les frais fixes pour chaque plateforme.
- [ ] Vérifier les valeurs nulles, zéro et les nombres décimaux.
- [ ] Vérifier que le dashboard reflète les données du compte connecté.

## 5. Tests manuels — ajout d'une annonce

- [ ] Ouvrir `/#/recherche` après connexion.
- [ ] Cliquer sur **Ajouter une annonce**.
- [ ] Ajouter une annonce sans URL, avec les champs obligatoires.
- [ ] Ajouter une annonce avec une URL Vinted.
- [ ] Ajouter une annonce avec une URL Leboncoin.
- [ ] Vérifier la détection de plateforme à partir de l'URL.
- [ ] Vérifier le refus d'un titre vide et d'un prix invalide.
- [ ] Enregistrer et vérifier l'ouverture de la fiche détail.
- [ ] Recharger la page et vérifier que l'annonce est toujours présente.
- [ ] Réimporter la même URL et vérifier le message de doublon.
- [ ] Tester une erreur réseau ou une session expirée.

**Important :** il s'agit d'une saisie manuelle. Coller l'URL ne récupère pas automatiquement le titre, le prix, les photos ou la description de la marketplace.

## 6. Tests manuels — analyse et comparables

- [ ] Depuis une fiche, lancer l'analyse IA.
- [ ] Vérifier le résultat lorsque la fonction Edge Function est déployée.
- [ ] Tester une annonce avec description courte et une annonce avec description détaillée.
- [ ] Tester une image valide et une image trop volumineuse ou non prise en charge.
- [ ] Vérifier les messages si la clé IA manque, si le fournisseur répond en erreur ou si le quota est dépassé.
- [ ] Ajouter un comparable de type « vente réalisée ».
- [ ] Ajouter un comparable de type « prix affiché ».
- [ ] Vérifier la date, la source, l'état et l'URL du comparable.
- [ ] Supprimer un comparable et vérifier le recalcul de l'estimation.
- [ ] Vérifier que l'application ne présente pas une estimation comme une garantie de vente.

## 7. Tests sécurité et isolation des données

Avec deux comptes Supabase distincts :

- [ ] Le compte A crée une annonce.
- [ ] Le compte B ne voit pas l'annonce de A dans les listes.
- [ ] Le compte B ne peut pas lire l'annonce de A en utilisant son UUID.
- [ ] Le compte B ne peut pas modifier ou supprimer l'annonce de A.
- [ ] Le compte B ne peut pas accéder aux comparables ou analyses de A.
- [ ] Vérifier que les appels à l'Edge Function exigent une session valide.
- [ ] Vérifier qu'aucune clé IA ou `service_role` n'apparaît dans les fichiers JavaScript compilés ou dans le dépôt.

## 8. Tests GitHub Pages

- [ ] Le workflow « Test, build et déploiement » termine avec succès.
- [ ] Le job de build exécute tests, typecheck et build.
- [ ] Le job de déploiement est exécuté uniquement après réussite du build.
- [ ] L'application s'ouvre à l'URL GitHub Pages.
- [ ] Les routes `/#/`, `/#/recherche`, `/#/parametres` et `/#/annonce/<id>` fonctionnent après actualisation.
- [ ] Les ressources CSS, JS, icônes et manifest sont chargées sans erreur.
- [ ] Vérifier au minimum Safari iOS et un navigateur de bureau.

## 9. Règle de validation d'une version

Une version ne doit être déclarée prête que si :

1. `npm test` réussit ;
2. `npm run typecheck` réussit ;
3. `npm run build` réussit ;
4. les migrations et fonctions serveur nécessaires sont déployées ;
5. le parcours utilisateur principal est validé ;
6. les tests RLS ne révèlent aucune fuite entre comptes ;
7. le déploiement GitHub Pages est terminé avec succès.
