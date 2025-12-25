-- Enable REPLICA IDENTITY FULL for attendance_records to ensure DELETE events include the full row data
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;