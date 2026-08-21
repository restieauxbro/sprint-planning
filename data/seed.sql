-- Seed plan for 18 Aug 2026 (current sprint 2026-S17).
-- Demonstrates: sequential phases, split backend, contention/push-out, slack, unscheduled, PTO.

DELETE FROM time_off;
DELETE FROM assignments;
DELETE FROM phase_dependencies;
DELETE FROM phases;
DELETE FROM projects;
DELETE FROM sprints;
DELETE FROM engineers;

INSERT INTO engineers (id, name, title, fte, sort_order) VALUES
  ('eng_maya', 'Maya Reed', 'Engineer', 1.0, 1),
  ('eng_julian', 'Julian Cho', 'Engineer', 1.0, 2),
  ('eng_priya', 'Priya Shah', 'Engineer', 1.0, 3),
  ('eng_owen', 'Owen Blake', 'Engineer', 1.0, 4),
  ('eng_nina', 'Nina Cole', 'BA', 1.0, 5);

INSERT INTO sprints (id, name, start_date, end_date, working_days) VALUES
  ('2026-S16', 'S16', '2026-08-03', '2026-08-14', 10),
  ('2026-S17', 'S17', '2026-08-17', '2026-08-28', 10),
  ('2026-S18', 'S18', '2026-08-31', '2026-09-11', 10),
  ('2026-S19', 'S19', '2026-09-14', '2026-09-25', 10),
  ('2026-S20', 'S20', '2026-09-28', '2026-10-09', 10),
  ('2026-S21', 'S21', '2026-10-12', '2026-10-23', 10),
  ('2026-S22', 'S22', '2026-10-26', '2026-11-06', 10),
  ('2026-S23', 'S23', '2026-11-09', '2026-11-20', 10),
  ('2026-S24', 'S24', '2026-11-23', '2026-12-04', 10),
  ('2026-S25', 'S25', '2026-12-07', '2026-12-18', 10),
  ('2026-S26', 'S26', '2026-12-21', '2027-01-01', 10),
  ('2026-S27', 'S27', '2027-01-04', '2027-01-15', 10);

-- Priority 1: Checkout. Maya walks discovery → solution → backend.
-- Julian joins backend at 50% so that phase finishes in 2 sprints instead of 3.
-- Owen takes frontend after backend completes.
-- Nina Cole (BA) is on the roster with no phase assignments yet.
INSERT INTO projects (id, name, code, color, priority, sort_order) VALUES
  ('proj_checkout', 'Checkout', 'Chk', 'teal', 1, 1),
  ('proj_payments', 'Payments', 'Pay', 'brass', 2, 2),
  ('proj_atlas', 'Atlas mobile', 'Atl', 'olive', 3, 3);

INSERT INTO phases (id, project_id, name, kind, sort_order, effort_days) VALUES
  ('phase_checkout_disc', 'proj_checkout', 'Discovery', 'discovery', 1, 5),
  ('phase_checkout_sol', 'proj_checkout', 'Solution', 'solution', 2, 10),
  ('phase_checkout_be', 'proj_checkout', 'Backend', 'backend', 3, 30),
  ('phase_checkout_fe', 'proj_checkout', 'Frontend', 'frontend', 4, 20),
  ('phase_payments_disc', 'proj_payments', 'Discovery', 'discovery', 1, 10),
  ('phase_payments_sol', 'proj_payments', 'Solution', 'solution', 2, 10),
  ('phase_atlas_disc', 'proj_atlas', 'Discovery', 'discovery', 1, 10),
  ('phase_atlas_sol', 'proj_atlas', 'Solution', 'solution', 2, 10),
  ('phase_atlas_be', 'proj_atlas', 'Backend', 'backend', 3, 20),
  ('phase_atlas_fe', 'proj_atlas', 'Frontend', 'frontend', 4, 15);

INSERT INTO phase_dependencies (
  predecessor_phase_id,
  successor_phase_id,
  dependency_type
) VALUES
  ('phase_checkout_disc', 'phase_checkout_sol', 'finish_to_start'),
  ('phase_checkout_sol', 'phase_checkout_be', 'finish_to_start'),
  ('phase_checkout_be', 'phase_checkout_fe', 'finish_to_start'),
  ('phase_payments_disc', 'phase_payments_sol', 'finish_to_start'),
  ('phase_atlas_disc', 'phase_atlas_sol', 'finish_to_start'),
  ('phase_atlas_sol', 'phase_atlas_be', 'finish_to_start'),
  ('phase_atlas_be', 'phase_atlas_fe', 'finish_to_start');

INSERT INTO assignments (phase_id, engineer_id, fraction) VALUES
  ('phase_checkout_disc', 'eng_maya', 1.0),
  ('phase_checkout_sol', 'eng_maya', 1.0),
  ('phase_checkout_be', 'eng_maya', 1.0),
  ('phase_checkout_be', 'eng_julian', 0.5),
  ('phase_checkout_fe', 'eng_owen', 1.0),
  -- Owen has slack until Checkout FE. He takes Payments discovery at 100%
  -- so Maya is not dual-booked. Julian's free 50% runs Payments solution
  -- alongside Checkout backend.
  ('phase_payments_disc', 'eng_owen', 1.0),
  ('phase_payments_sol', 'eng_julian', 0.5),
  ('phase_atlas_disc', 'eng_priya', 1.0),
  ('phase_atlas_sol', 'eng_priya', 1.0),
  ('phase_atlas_be', 'eng_priya', 1.0);
  -- phase_atlas_fe is intentionally unassigned.

INSERT INTO time_off (engineer_id, sprint_id, days_off) VALUES
  ('eng_julian', '2026-S19', 2);
