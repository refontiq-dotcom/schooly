update public.enrollment_applications ea
set student_id = s.id,
    updated_at = now()
from public.students s
where s.reservation_id = ea.reservation_id
  and ea.student_id is null;
