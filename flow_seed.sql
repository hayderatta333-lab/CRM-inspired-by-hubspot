INSERT INTO flows (org_id, name, status, trigger_keywords, nodes, edges)
VALUES (
  '304206e2-c776-4034-b4b3-6f65a2e5b2af',
  'BranchTest',
  'draft',
  ARRAY['branchtest'],
  '[
    {"id":"n1","data":{"nodeType":"menu","message":"Hi! Reply 1 for Sales or 2 for Support","options":["Sales","Support"]}},
    {"id":"n2","data":{"nodeType":"greeting","message":"Great, connecting you to our Sales team!"}},
    {"id":"n3","data":{"nodeType":"greeting","message":"Great, connecting you to our Support team!"}}
  ]'::jsonb,
  '[
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n1","target":"n3"}
  ]'::jsonb
);
