begin;
select plan(43);
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','dir-a@test.local'),
 ('10000000-0000-0000-0000-000000000002','dir-b@test.local'),
 ('10000000-0000-0000-0000-000000000003','teacher@test.local');
insert into public.schools(id,name) values
 ('20000000-0000-0000-0000-000000000001','A'),('20000000-0000-0000-0000-000000000002','B');
insert into public.user_school_roles(user_id,school_id,role_code) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','direction'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','direction'),
 ('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','professeur');
insert into public.academic_years(id,school_id,label,start_date,end_date) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Test',current_date-100,current_date+100),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Test',current_date-100,current_date+100);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',true);
select lives_ok($$insert into public.evaluation_rules(id,school_id,academic_year_id,mode,scale,threshold)
 values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','TRIMESTRE',20,10)$$,'Direction configure son école');
select throws_ok($$insert into public.evaluation_rules(school_id,academic_year_id,mode,scale,threshold)
 values ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','TRIMESTRE',20,10)$$,'42501',null,'Écriture cross-tenant refusée');
select throws_ok($$insert into public.evaluation_rules(school_id,academic_year_id,mode,scale,threshold)
 values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','TRIMESTRE',20,10)$$,'P0001','Année académique invalide.','Relation année cross-tenant refusée');
select lives_ok($$insert into public.evaluation_periods(id,school_id,rule_id,label,position,starts_at,ends_at)
 values ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','T1',1,now()-interval '1 day',now()+interval '1 day')$$,'Création période');
select throws_ok($$insert into public.evaluation_periods(school_id,rule_id,label,position,starts_at,ends_at)
 values ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','T2',2,now(),now()+interval '2 days')$$,'P0001','Les périodes ne doivent pas se chevaucher.','Chevauchement refusé');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002"}',true);
select is((select count(*)::int from public.evaluation_rules),0,'Autre école ne voit pas les règles');
select is((select count(*)::int from public.evaluation_periods),0,'Autre école ne voit pas les périodes');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003"}',true);
select throws_ok($$insert into public.evaluation_periods(school_id,rule_id,label,position,starts_at,ends_at)
 values ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','T2',2,now()+interval '3 days',now()+interval '4 days')$$,'42501',null,'Professeur ne configure pas les périodes');
reset role;
insert into public.grade_levels(id,school_id,name,level,cycle) values ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','CM2',5,'primaire');
insert into public.classes(id,school_id,grade_level_id,name) values ('61000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','CM2 A');
insert into public.subjects(id,school_id,name) values ('62000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Maths');
insert into public.students(id,school_id,first_name,last_name,date_of_birth) values ('63000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','A','Élève','2015-01-01');
insert into public.guardians(id,phone,full_name) values ('64000000-0000-0000-0000-000000000001','0000000000','Parent');
insert into public.enrollments(id,school_id,student_id,guardian_id,grade_level_id,class_id,academic_year_id) values
 ('65000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
-- Fonction de test SECURITY INVOKER : conserve les contrôles RLS réels.
create function public.test_insert_grade(v numeric, status text, label text, assessment uuid) returns void language sql as $$
 insert into public.grade_entries(school_id,enrollment_id,subject_id,academic_year_id,period_id,assessment_id,grade_type,label,value,max_value,absence_status,created_by)
 values ('20000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',assessment,'devoir',label,v,40,status,auth.uid());
$$;
set local role authenticated;
select throws_ok($$select public.test_insert_grade(30,'graded','Non affecté',null)$$,'P0001','Sélectionnez une évaluation attendue.','Note sans évaluation attendue refusée');
select throws_ok($$insert into public.evaluation_assessments(school_id,period_id,class_id,subject_id,grade_type,label,max_value,created_by)
 values ('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','devoir','DS0',40,auth.uid())$$
 ,'P0001','Classe ou matière non affectée.','Matière non affectée refusée');
reset role;
insert into public.class_subject_assignments(school_id,class_id,subject_id,teacher_id) values
 ('20000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok($$insert into public.evaluation_assessments(id,school_id,period_id,class_id,subject_id,grade_type,label,max_value,created_by) values
 ('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','devoir','DS1',40,'10000000-0000-0000-0000-000000000003'),
 ('70000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','devoir','DS2',40,'10000000-0000-0000-0000-000000000003'),
 ('70000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','devoir','DS3',40,'10000000-0000-0000-0000-000000000003'),
 ('70000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','devoir','DS4',40,'10000000-0000-0000-0000-000000000003')$$,
 'Professeur affecté déclare les évaluations attendues');
select lives_ok($$select public.test_insert_grade(30,'graded','DS1','70000000-0000-0000-0000-000000000001')$$,'Professeur affecté saisit 30/40 sur DS1');
select is((select max_value from public.grade_entries where assessment_id='70000000-0000-0000-0000-000000000001'),40::numeric,'Métadonnées imposées par l''évaluation attendue');
select throws_ok($$select public.test_insert_grade(20,'graded','Doublon','70000000-0000-0000-0000-000000000001')$$,'23505',null,'Une seule note par inscription et évaluation');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002"}',true);
select is((select count(*)::int from public.evaluation_assessments),0,'Autre école ne voit pas les évaluations attendues');
select throws_ok($$insert into public.evaluation_assessments(school_id,period_id,class_id,subject_id,grade_type,label,max_value,created_by)
 values ('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','devoir','Intrus',40,auth.uid())$$,'42501',null,'Autre école ne peut pas déclarer une évaluation');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003"}',true);
select lives_ok($$select public.test_insert_grade(null,'excused','DS2','70000000-0000-0000-0000-000000000002')$$,'ABS sans valeur accepté');
select throws_ok($$select public.test_insert_grade(0,'excused','DS3','70000000-0000-0000-0000-000000000003')$$,'23514',null,'ABS avec zéro refusé');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',true);
select is((select count(*)::int from public.evaluation_assessments),4,'Direction voit les évaluations déclarées');
-- ===== Lot 3 : corrections auditées (avant la clôture) =====
select set_config('test.grade_id',(select id::text from public.grade_entries where assessment_id='70000000-0000-0000-0000-000000000001'),true);
select is((select revision from public.grade_entries where assessment_id='70000000-0000-0000-0000-000000000001'),1,'Toute note démarre en version 1');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003"}',true);
select throws_ok($$update public.grade_entries set value=18 where assessment_id='70000000-0000-0000-0000-000000000001'$$,'42501',null,'Aucun UPDATE direct depuis l''API');
select lives_ok($$select public.correct_evaluation_grade('20000000-0000-0000-0000-000000000001',current_setting('test.grade_id')::uuid,1,18,'graded','Relu par l''élève','Erreur de report au tableau')$$,'Le professeur affecté corrige sa note avec motif');
select is((select revision from public.grade_entries where assessment_id='70000000-0000-0000-0000-000000000001'),2,'La version passe réellement à 2');
select is((select value from public.grade_entries where assessment_id='70000000-0000-0000-0000-000000000001'),18::numeric,'La valeur corrigée est persistée');
select is((select reason from public.grade_corrections where grade_id=current_setting('test.grade_id')::uuid and revision=2),'Erreur de report au tableau','Le motif est journalisé');
select throws_ok($$select public.correct_evaluation_grade('20000000-0000-0000-0000-000000000001',current_setting('test.grade_id')::uuid,1,15,'graded','x','Erreur de saisie')$$,'40001',null,'Ancienne version refusée');
select lives_ok($$select public.correct_evaluation_grade('20000000-0000-0000-0000-000000000001',current_setting('test.grade_id')::uuid,2,null,'excused',null,'L''élève était absent, DS déplacé')$$,'Passage en ABS justifiée avec motif');
select is((select value from public.grade_entries where assessment_id='70000000-0000-0000-0000-000000000001'),null,'ABS sans valeur');
select is((select count(*)::int from public.grade_corrections where grade_id=current_setting('test.grade_id')::uuid),2,'Deux entrées de journal');
select throws_ok($$select public.correct_evaluation_grade('20000000-0000-0000-0000-000000000001',current_setting('test.grade_id')::uuid,3,50,'graded',null,'Note incohérente')$$,'P0001','Note ou statut invalide.','Note hors barème refusée');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',true);
select is((select count(*)::int from public.grade_corrections),2,'Direction lit le journal complet');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002"}',true);
select is((select count(*)::int from public.grade_corrections),0,'Autre école ne voit pas le journal');
select throws_ok($$select public.correct_evaluation_grade('20000000-0000-0000-0000-000000000001',current_setting('test.grade_id')::uuid,3,15,'graded',null,'Tentative intruse')$$,'42501',null,'École B ne corrige pas la note de l''école A');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',true);
select lives_ok($$update public.evaluation_periods set locked_at=now() where id='50000000-0000-0000-0000-000000000001'$$,'Direction clôture');
select throws_ok($$select public.correct_evaluation_grade('20000000-0000-0000-0000-000000000001',current_setting('test.grade_id')::uuid,3,20,'graded',null,'Reprise de classe')$$,'P0001','La période est verrouillée ou non ouverte.','Correction après clôture refusée');
select throws_ok($$select public.test_insert_grade(30,'graded','DS4','70000000-0000-0000-0000-000000000004')$$,'P0001','La période est verrouillée ou non ouverte.','Saisie après clôture refusée');
select throws_ok($$insert into public.evaluation_assessments(school_id,period_id,class_id,subject_id,grade_type,label,max_value,created_by)
 values ('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','devoir','DS5',40,'10000000-0000-0000-0000-000000000001')$$
 ,'P0001','La période est verrouillée ou terminée.','Déclaration après clôture refusée');
select is((select locked_at is not null from public.evaluation_periods where id='50000000-0000-0000-0000-000000000001'),true,'Clôture réellement persistée');
-- Lot 4 : validation officielle du résultat annuel (direction uniquement).
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',true);
select throws_ok($$select public.validate_annual_decision('65000000-0000-0000-0000-000000000001','admitted',15,'empreinte-faussee',null)$$
 ,'40001','Les données ont changé depuis l''aperçu : relancez le calcul.','Validation avec empreinte obsolète refusée');
select lives_ok($$select public.validate_annual_decision('65000000-0000-0000-0000-000000000001','admitted',15,
 (select public.annual_input_fingerprint('65000000-0000-0000-0000-000000000001')),null)$$,'Direction valide le résultat annuel');
select throws_ok($$select public.validate_annual_decision('65000000-0000-0000-0000-000000000001','admitted',15,
 (select public.annual_input_fingerprint('65000000-0000-0000-0000-000000000001')),null)$$
 ,'P0001','Résultat déjà validé et immuable.','Revalidation refusée');
select is((select decision from public.academic_decisions where enrollment_id='65000000-0000-0000-0000-000000000001'),'admitted','Décision validée persistée');
-- En superutilisateur : on neutralise le verrou de période (antérieur alphabétiquement)
-- pour isoler le verrou de validation. Le rollback final restaure l'état des triggers.
reset role;
alter table public.grade_entries disable trigger grade_entries_period_validate;
select throws_ok($$update public.grade_entries set value=31 where assessment_id='70000000-0000-0000-0000-000000000001'$$
 ,'P0001','Résultat annuel validé : les notes ne peuvent plus être modifiées.','Écriture de note après validation refusée');

select * from finish();
rollback;
