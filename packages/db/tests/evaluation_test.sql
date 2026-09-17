begin;
select plan(15);
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
create function public.test_insert_grade(v numeric, status text, label text) returns void language sql as $$
 insert into public.grade_entries(school_id,enrollment_id,subject_id,academic_year_id,period_id,grade_type,label,value,max_value,absence_status,created_by)
 values ('20000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','devoir',label,v,40,status,auth.uid());
$$;
set local role authenticated;
select throws_ok($$select public.test_insert_grade(30,'graded','Non affecté')$$,'42501',null,'Professeur non affecté refusé');
reset role;
insert into public.class_subject_assignments(school_id,class_id,subject_id,teacher_id) values
 ('20000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok($$select public.test_insert_grade(30,'graded','DS1')$$,'Professeur affecté saisit 30/40');
select lives_ok($$select public.test_insert_grade(null,'excused','DS2')$$,'ABS sans valeur accepté');
select throws_ok($$select public.test_insert_grade(0,'excused','DS3')$$,'23514',null,'ABS avec zéro refusé');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',true);
select lives_ok($$update public.evaluation_periods set locked_at=now() where id='50000000-0000-0000-0000-000000000001'$$,'Direction clôture');
select throws_ok($$select public.test_insert_grade(30,'graded','Après clôture')$$,'P0001','La période est verrouillée ou non ouverte.','Saisie après clôture refusée');
select is((select locked_at is not null from public.evaluation_periods where id='50000000-0000-0000-0000-000000000001'),true,'Clôture réellement persistée');
select * from finish();
rollback;
