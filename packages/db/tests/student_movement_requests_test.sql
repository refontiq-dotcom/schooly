begin;
select plan(48);
create function public.movement_test_id(text) returns uuid language sql immutable as $$ select md5($1)::uuid $$;
insert into auth.users(id,email) select public.movement_test_id(x), x || '@test.local'
 from unnest(array['direction','other','teacher']) x;
insert into public.schools(id,name) select public.movement_test_id(x), x from unnest(array['school','other-school']) x;
insert into public.user_school_roles(user_id,school_id,role_code) values
 (public.movement_test_id('direction'),public.movement_test_id('school'),'direction'),
 (public.movement_test_id('other'),public.movement_test_id('other-school'),'direction'),
 (public.movement_test_id('teacher'),public.movement_test_id('school'),'professeur');
insert into public.academic_years(id,school_id,label,start_date,end_date)
 values(public.movement_test_id('year'),public.movement_test_id('school'),'Test',current_date-10,current_date+100);
insert into public.grade_levels(id,school_id,name,level,cycle)
 values(public.movement_test_id('level'),public.movement_test_id('school'),'CM2',5,'primaire');
insert into public.guardians(id,phone,full_name) values(public.movement_test_id('guardian'),'0000000000','Test');
insert into public.students(id,school_id,first_name,last_name,date_of_birth)
 select public.movement_test_id(x),public.movement_test_id('school'),x,'Test','2015-01-01'::date
 from unnest(array['student1','student2']) x;
insert into public.enrollments(id,school_id,student_id,guardian_id,grade_level_id,academic_year_id)
 select public.movement_test_id(x),public.movement_test_id('school'),public.movement_test_id(x),
 public.movement_test_id('guardian'),public.movement_test_id('level'),public.movement_test_id('year')
 from unnest(array['student1','student2']) x;
create function public.movement_test_insert(p_school text, p_student text, p_kind text)
 returns void language sql as $$
 insert into public.student_movement_requests(school_id,enrollment_id,kind,reason,decision_reference,issuing_authority,scholarship_status,national_matricule)
 values(public.movement_test_id(p_school),public.movement_test_id(p_student),p_kind,'Déménagement',
 case when p_kind='ORT' then 'DEC-123' end,case when p_kind='ORT' then 'Autorité déclarée' end,
 case when p_kind='ORT' then 'inconnu' end,'MATRICULE-FORGE');
$$;
-- Lecture du code réservée au propriétaire : l'école d'accueil ne voit jamais la demande source.
create function public.movement_test_code(p_kind text) returns text
 language sql security definer set search_path = public as $$
 select tracking_code from public.student_movement_requests where kind = p_kind
$$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('direction'))::text,true);
select lives_ok($$select public.movement_test_insert('school','student1','TRF')$$,'Direction prépare TRF');
select is((select count(*)::int from public.student_movement_requests),1,'Direction lit sa demande');
select is((select student_id from public.student_movement_requests),public.movement_test_id('student1'),'Élève issu de l’inscription');
select is((select national_matricule from public.student_movement_requests),null::text,'Matricule fourni ignoré');
select is((select created_by from public.student_movement_requests),public.movement_test_id('direction'),'Auteur issu de la session');
select throws_ok($$select public.movement_test_insert('school','student1','TRF')$$,'23505',null,'Doublon refusé');
select throws_ok($$select public.movement_test_insert('school','student2','ORT')$$,'P0001',
 'Le matricule national doit être renseigné dans l’inscription avant de préparer une orientation.','ORT sans matricule source refusé');
select throws_ok($$select public.movement_test_insert('other-school','student2','TRF')$$,'P0001',
 'Inscription active introuvable dans cet établissement.','Relation inscription/école contrôlée');
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('other'))::text,true);
select is((select count(*)::int from public.student_movement_requests),0,'Autre école ne lit pas les demandes');
select throws_ok($$select public.movement_test_insert('school','student2','TRF')$$,'42501',null,'Autre école ne crée pas de demande');
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('teacher'))::text,true);
select throws_ok($$select public.movement_test_insert('school','student2','TRF')$$,'42501',null,'Professeur refusé');
reset role;
update public.enrollments set matricule='MENA-TEST' where id=public.movement_test_id('student2');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('direction'))::text,true);
select lives_ok($$select public.movement_test_insert('school','student2','ORT')$$,'ORT préparée avec matricule source et référence déclarée');
select is((select status from public.student_movement_requests where kind='ORT'),'DRAFT','ORT reste non certifiée');
select throws_ok($$update public.student_movement_requests set status='ISSUED'$$,'42501',null,'Aucune émission possible');
select is((select tracking_code ~ '^ORT[0-9A-HJKMNP-TV-Z]{5}$' from public.student_movement_requests where kind='ORT'),true,'Code ORT de huit caractères enregistré');
select is(public.movement_code_checksum('TRF0123'),'E','Checksum identique à la validation navigateur (TRF0123)');
select is((select right(tracking_code,1) = public.movement_code_checksum(left(tracking_code,7)) from public.student_movement_requests where kind='ORT'),true,'Checksum du code enregistré valide');
select is((select national_matricule from public.student_movement_requests where kind='ORT'),'MENA-TEST','Matricule national conservé dans la demande');
reset role;
select is((select count(*)::int from public.enrollments),2,'Aucune inscription supplémentaire créée');
select is((select count(*)::int from public.enrollments where status='active'),2,'Les inscriptions sources restent actives');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('direction'))::text,true);
select is((select status from public.activate_student_movement(public.movement_test_id('school'),
 (select id from public.student_movement_requests where kind='TRF'))),'ACTIVE','TRF devient actif');
select is((select count(*)::int from public.student_movement_activations),1,'Activation persistée');
select is((select expires_at-activated_at from public.student_movement_activations),interval '60 days','Validité de 60 jours');
select is((select count(*)::int from public.student_movement_activation_audit),1,'Audit unique persisté');
select is((select actor_id from public.student_movement_activation_audit),public.movement_test_id('direction'),'Auteur authentifié de l’activation');
select is((select status from public.activate_student_movement(public.movement_test_id('school'),
 (select id from public.student_movement_requests where kind='TRF'))),'ACTIVE','Nouvel appel idempotent');
select is((select count(*)::int from public.student_movement_activation_audit),1,'Aucun doublon d’audit');
select throws_ok($$select public.activate_student_movement(public.movement_test_id('school'),
 (select id from public.student_movement_requests where kind='ORT'))$$,'P0001',
 'La validation administrative ORT n’est pas encore disponible.','ORT ne s’active pas par son préfixe');
select throws_ok($$delete from public.student_movement_activation_audit$$,'42501',null,'Audit non effaçable par le client');
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('other'))::text,true);
select throws_ok($$select public.activate_student_movement(public.movement_test_id('school'),public.movement_test_id('anything'))$$,
 '42501','Activation réservée à la direction de cet établissement.','Autre direction refusée');
select is((select count(*)::int from public.student_movement_activations),0,'Activation invisible à l’autre école');
reset role;
select is((select count(*)::int from public.enrollments where status='active'),2,'Activation ne transfère aucune inscription');
-- Simulation temporelle réservée au propriétaire dans cette base jetable.
update public.student_movement_activations
 set activated_at=now()-interval '61 days', expires_at=now()-interval '1 day';
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('direction'))::text,true);
select is((select status from public.activate_student_movement(public.movement_test_id('school'),
 (select id from public.student_movement_requests where kind='TRF'))),'EXPIRED','Activation expirée non renouvelée');
select is((select count(*)::int from public.student_movement_activation_audit),1,'Expiration ne recrée pas d’activation ni d’audit');
-- ==== Import effectif entre deux écoles ====
reset role;
insert into public.academic_years(id,school_id,label,start_date,end_date)
 values(public.movement_test_id('year-to'),public.movement_test_id('other-school'),'Test',current_date-10,current_date+100);
insert into public.grade_levels(id,school_id,name,level,cycle)
 values(public.movement_test_id('level-to'),public.movement_test_id('other-school'),'6e',6,'college');
insert into public.classes(id,school_id,grade_level_id,name)
 values(public.movement_test_id('class-to'),public.movement_test_id('other-school'),public.movement_test_id('level-to'),'6e A');
-- La simulation temporelle précédente a expiré le code : on restaure sa validité.
update public.student_movement_activations set activated_at=now(), expires_at=now()+interval '60 days';
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('other'))::text,true);
select throws_ok($$select public.consume_student_movement(
 public.movement_test_code('TRF'),
 public.movement_test_id('other-school'),public.movement_test_id('class-to'),public.movement_test_id('year-to'))$$,
 '42501','Établissement d''accueil non autorisé par la direction source.','Accueil non autorisé refusé avant autorisation');
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('direction'))::text,true);
select lives_ok($$select public.authorize_student_movement_destination(public.movement_test_id('school'),
 (select id from public.student_movement_requests where kind='TRF'),public.movement_test_id('other-school'),
 'Vérification administrative et financière effectuée par la direction.')$$,'Direction source autorise nommément l''accueil');
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('teacher'))::text,true);
select throws_ok($$select public.consume_student_movement(
 public.movement_test_code('TRF'),
 public.movement_test_id('other-school'),public.movement_test_id('class-to'),public.movement_test_id('year-to'))$$,
 '42501',null,'Professeur ne peut pas importer');
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('other'))::text,true);
select throws_ok($$select public.consume_student_movement(
 public.movement_test_code('ORT'),
 public.movement_test_id('other-school'),public.movement_test_id('class-to'),public.movement_test_id('year-to'))$$,
 'P0001','L''import ORT n''est pas disponible.','ORT non importable');
select lives_ok($$select public.consume_student_movement(
 public.movement_test_code('TRF'),
 public.movement_test_id('other-school'),public.movement_test_id('class-to'),public.movement_test_id('year-to'))$$,
 'Import TRF effectué par l''école autorisée');
reset role;
select is((select count(*)::int from public.enrollments where school_id=public.movement_test_id('other-school')),1,'Nouvelle inscription créée à l''accueil');
select is((select status from public.enrollments where id=public.movement_test_id('student1')),'transferred','Inscription source marquée transférée');
select is((select count(*)::int from public.enrollments where id=public.movement_test_id('student1')),1,'Inscription source conservée');
select is((select count(*)::int from public.students where school_id=public.movement_test_id('other-school')),1,'Fiche élève créée à l''accueil');
select is((select guardian_id from public.enrollments where school_id=public.movement_test_id('other-school')),
 public.movement_test_id('guardian'),'Tuteur existant conservé');
select is((select grade_level_id from public.enrollments where school_id=public.movement_test_id('other-school')),
 public.movement_test_id('level-to'),'Niveau déduit de la classe d''accueil');
select is((select count(*)::int from public.student_movement_imports),1,'Import journalisé une seule fois');
select is((select imported_by from public.student_movement_imports),public.movement_test_id('other'),'Auteur authentifié de l''import');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',public.movement_test_id('other'))::text,true);
select throws_ok($$select public.consume_student_movement(
 public.movement_test_code('TRF'),
 public.movement_test_id('other-school'),public.movement_test_id('class-to'),public.movement_test_id('year-to'))$$,
 '23505',null,'Réutilisation du code refusée');
select * from finish();
rollback;
