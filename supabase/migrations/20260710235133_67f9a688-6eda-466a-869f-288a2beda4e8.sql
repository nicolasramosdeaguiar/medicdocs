ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS requesting_doctor_name text,
  ADD COLUMN IF NOT EXISTS requesting_doctor_crm text,
  ADD COLUMN IF NOT EXISTS reporting_doctor_name text,
  ADD COLUMN IF NOT EXISTS reporting_doctor_crm text;