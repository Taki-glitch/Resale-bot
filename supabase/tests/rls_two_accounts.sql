-- Test d'isolation entre deux comptes (RLS + déclencheurs de propriétaire + protection des produits).
-- Mode d'emploi :
--   1. Supabase → Authentication → Users : copie l'identifiant (UUID) de DEUX comptes différents.
--   2. Remplace les valeurs de a et b ci-dessous, puis exécute tout le script dans le SQL Editor.
--   3. Le script crée des données temporaires puis s'annule TOUJOURS (aucune donnée conservée).
-- Résultat attendu : une « erreur » dont le message commence par « TEST TERMINÉ : tous les contrôles sont OK ».
-- Tout autre message commençant par « ÉCHEC » indique un défaut d'isolation à corriger avant la mise en production.
do $test$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';  -- À REMPLACER : compte A
  b uuid := '00000000-0000-0000-0000-00000000000b';  -- À REMPLACER : compte B
  p_a uuid;
  l_a uuid;
  n integer;
  blocked boolean;
begin
  if a::text like '00000000-%' or b::text like '00000000-%' then
    raise exception 'Remplace les identifiants a et b par ceux de deux vrais comptes (Authentication → Users).';
  end if;

  -- Compte A : crée un produit et une annonce.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.products (name) values ('RLS_TEST_A') returning id into p_a;
  insert into public.listings (title, platform, product_id) values ('RLS_TEST_ANNONCE_A', 'manual', p_a) returning id into l_a;

  -- Compte B : ne voit rien et ne peut rien modifier ni supprimer chez A.
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.products where id = p_a;
  if n <> 0 then raise exception 'ÉCHEC : B voit le produit de A'; end if;
  select count(*) into n from public.listings where id = l_a;
  if n <> 0 then raise exception 'ÉCHEC : B voit l''annonce de A'; end if;

  update public.products set name = 'PIRATE' where id = p_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ÉCHEC : B a modifié le produit de A'; end if;

  delete from public.listings where id = l_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ÉCHEC : B a supprimé l''annonce de A'; end if;

  -- Compte B : ne peut pas RÉFÉRENCER les données de A (déclencheurs de propriétaire).
  blocked := false;
  begin
    insert into public.listings (title, platform, product_id) values ('RLS_TEST_B', 'manual', p_a);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'ÉCHEC : B a pu créer une annonce référençant le produit de A'; end if;

  blocked := false;
  begin
    insert into public.notifications (type, title, listing_id) values ('test', 'RLS_TEST', l_a);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'ÉCHEC : B a pu créer une notification référençant l''annonce de A'; end if;

  blocked := false;
  begin
    insert into public.opportunities (listing_id) values (l_a);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'ÉCHEC : B a pu créer une opportunité référençant l''annonce de A'; end if;

  -- Compte A : un produit encore utilisé par une annonce ne peut pas être supprimé directement.
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  blocked := false;
  begin
    delete from public.products where id = p_a;
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'ÉCHEC : un produit encore utilisé a pu être supprimé'; end if;

  -- Compte A : la suppression ordonnée (annonce puis produit) reste possible.
  delete from public.listings where id = l_a;
  delete from public.products where id = p_a;

  raise exception 'TEST TERMINÉ : tous les contrôles sont OK (aucune donnée conservée).';
end
$test$;
