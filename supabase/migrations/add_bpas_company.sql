-- Add BPAS (Bulletproof Auto Spa) as 4th company association
-- Migration: add is_bpas to projects, is_bpas_employee to owners

ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_bpas boolean DEFAULT false;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_bpas_employee boolean DEFAULT false;
