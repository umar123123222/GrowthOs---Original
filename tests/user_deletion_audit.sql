-- Unit tests for user deletion audit functionality
-- Using pgTAP testing framework

BEGIN;
SELECT plan(4);

-- Test 1: Normal user deletion logs entry and succeeds
INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111', 'test@example.com');
DELETE FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT ok(
  EXISTS(
    SELECT 1 FROM admin_logs 
    WHERE entity_id = '11111111-1111-1111-1111-111111111111' 
    AND action = 'auth_deleted'
    AND performed_by = '11111111-1111-1111-1111-111111111111'
  ),
  'Normal user deletion creates audit log with user ID'
);

-- Test 2: Service role deletion succeeds and logs with NULL performed_by
-- Simulate service role context
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';

INSERT INTO auth.users (id, email) VALUES ('22222222-2222-2222-2222-222222222222', 'service@example.com');
DELETE FROM auth.users WHERE id = '22222222-2222-2222-2222-222222222222';

SELECT ok(
  EXISTS(
    SELECT 1 FROM admin_logs 
    WHERE entity_id = '22222222-2222-2222-2222-222222222222' 
    AND action = 'auth_deleted'
    AND performed_by IS NULL
  ),
  'Service role deletion creates audit log with NULL performed_by'
);

-- Test 3: Count NULL performed_by entries
SELECT ok(
  (SELECT count(*) FROM admin_logs WHERE performed_by IS NULL) >= 1,
  'At least one audit log entry has NULL performed_by after service role deletion'
);

-- Test 4: Verify FK constraint allows NULL
SELECT ok(
  (SELECT is_nullable FROM information_schema.columns 
   WHERE table_name = 'admin_logs' AND column_name = 'performed_by') = 'YES',
  'admin_logs.performed_by column is nullable'
);

SELECT * FROM finish();
ROLLBACK;