# RESALE BOT — Plan de tests

## 1. Commandes locales

À exécuter depuis la racine du dépôt, avec Node.js conforme à la version minimale indiquée dans `package.json` :

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Sans environnement local, ces commandes s'exécutent dans GitHub Codespaces ou via le workflow « CI (pull request) ». `npm ci` nécessite un `package-lock.json` cohérent avec `package.json`. Tant que ce fichier n'est pas généré, utiliser temporairement `npm install`, puis créer et committer le lockfile.

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
- chargement des paramètres par défaut et fusion des paramètres partiels (dont poids de scoring) ;
- score sur 100 : critères non mesurés à 0 point, recalibrage des poids, plafond sans données ;
- évaluation : non évaluable sans comparables, excellente / bonne / sous conditions / à éviter, budget dépassé, risque élevé, confiance croissante avec les ventes réalisées, prix anormalement bas ou élevé, signature de persistance ;
- opportunités : tris, filtres, historique, sélection ;
- notifications : événements (devient évaluable / non évaluable, recommandation modifiée, score en hausse, nouveau risque, réévaluation nécessaire), déduplication, silence quand rien ne change ;
- recherche : filtres combinés, tris, aller-retour d'une recherche enregistrée, anciennes recherches lisibles ;
- coûts détaillés, scénarios, estimation pondérée, plafonds de prudence ;
- suppression : un produit encore utilisé n'est pas supprimé.

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

## 6 bis. Tests manuels — évaluation, opportunités et notifications (V0.3)

Prérequis : migration `0003_v03.sql` exécutée.

- [ ] Ouvrir une annonce sans comparable : « Non évaluable », aucun score, message « Estimation insuffisamment documentée ».
- [ ] Ajouter 3 comparables : l'évaluation apparaît (recommandation, score, bénéfice net, marge, prix d'achat maximal, confiance, risque, justification).
- [ ] Vérifier que le détail du score indique les critères « non mesuré » (0 point) et que le score reste cohérent.
- [ ] Ajouter des ventes réalisées récentes : la demande et la confiance augmentent.
- [ ] Modifier le prix demandé (bouton « Modifier l'annonce ») : l'évaluation se met à jour.
- [ ] Vérifier le refus d'un doublon lors de la modification vers une URL déjà enregistrée.
- [ ] Ouvrir **Opportunités** : l'annonce apparaît ; tester les filtres, les tris, « Ma sélection », « Historique complet » et « Non évaluables ».
- [ ] Changer le statut (ex. « Refusée ») : elle sort de la vue « En cours » et reste dans l'historique.
- [ ] Obtenir une « bonne » ou « excellente » affaire au-dessus du bénéfice minimum : une notification apparaît ; la recharger ne la duplique pas.
- [ ] Vérifier le compteur de notifications non lues, « Marquer comme lu » et « Tout marquer comme lu ».
- [ ] Modifier les poids du score dans Paramètres, enregistrer, revenir sur une annonce : le score change.
- [ ] Vérifier que le tableau de bord affiche les meilleures opportunités et les dernières annonces.
- [ ] Vérifier la suppression d'une annonce (confirmation demandée) : l'opportunité et les notifications liées disparaissent.

## 6 quater. Tests manuels — achats, inventaire, ventes (V0.4)

Prérequis : migration `0005_v04.sql` exécutée.

- [ ] Depuis une annonce : « J'ai acheté cet article » → confirmation → l'article apparaît dans Inventaire (statut « Acheté »), l'opportunité passe à « Achetée ».
- [ ] Ajouter 2 photos à l'article : elles s'affichent (vignette dans la liste). Un autre compte ne voit pas ces fichiers.
- [ ] Ajouter une dépense (ex. nettoyage 3 €) : le coût total augmente.
- [ ] Passer l'article en « Reçu » puis « En préparation » : il apparaît dans Reventes.
- [ ] « Pré-remplir » : titre, description et prix proposés ; sans comparable → « Estimation indisponible ».
- [ ] Enregistrer la vente : l'article passe à « Vendu », le bénéfice réalisé = vente − commission − livraison − autres − (achat + frais + dépenses).
- [ ] Un second essai de vente du même article est refusé.
- [ ] Un article vendu ne peut pas être supprimé ; un article non vendu se supprime après confirmation.
- [ ] Ventes : chiffres cohérents avec la saisie ; filtre par mois ; exports CSV ouvrables dans Excel ; sauvegarde JSON téléchargée.
- [ ] Une cellule texte commençant par « = » est exportée précédée d'une apostrophe.
- [ ] Article sans coût d'achat connu : bénéfice « inconnu », exclu du bénéfice total.
- [ ] Dashboard : bénéfice du mois, valeur du stock et alerte stock cohérents.

## 6 ter. Contrôles SQL (Supabase → SQL Editor)

```sql
-- Tables sans RLS (doit renvoyer 0 ligne)
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;

-- Déclencheurs de propriétaire installés (11 tables attendues)
select event_object_table, count(*) from information_schema.triggers
where trigger_schema = 'public' and trigger_name = 'trg_same_owner' group by 1 order by 1;
```

- [ ] Avec deux comptes : insérer, depuis le compte B, un commentaire/comparable/notification qui référence un identifiant du compte A → l'insertion doit échouer (« Référence invalide »).
- [ ] Un produit utilisé par une annonce ne peut pas être supprimé directement (erreur 23503).
- [ ] Supprimer une annonce dont le produit sert à une autre annonce : le produit et ses comparables restent.

## 7. Tests sécurité et isolation des données

Avec deux comptes Supabase distincts :

- [ ] Le compte A crée une annonce.
- [ ] Le compte B ne voit pas l'annonce de A dans les listes.
- [ ] Le compte B ne peut pas lire l'annonce de A en utilisant son UUID.
- [ ] Le compte B ne peut pas modifier ou supprimer l'annonce de A.
- [ ] Le compte B ne peut pas accéder aux comparables, analyses, opportunités ou notifications de A.
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
