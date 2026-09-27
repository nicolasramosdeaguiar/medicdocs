CREATE TABLE public.case_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content jsonb NOT NULL,
  source_document_ids uuid[] NOT NULL DEFAULT '{}',
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_summaries TO authenticated;
GRANT ALL ON public.case_summaries TO service_role;
ALTER TABLE public.case_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own case summaries" ON public.case_summaries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX case_summaries_owner_latest ON public.case_summaries (user_id, created_at DESC);

CREATE TABLE public.case_notes (
  user_id uuid PRIMARY KEY,
  treatment_protocol text,
  current_cycle text,
  allergies text,
  next_procedure text,
  care_team_contact text,
  other_notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_notes TO authenticated;
GRANT ALL ON public.case_notes TO service_role;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own case notes" ON public.case_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER case_notes_set_updated_at BEFORE UPDATE ON public.case_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shares ADD COLUMN include_case_summary boolean NOT NULL DEFAULT false;