-- Convert membership roles from HOST/MEMBER to CO_HOST/MEMBER.
-- The original creator remains the true owner through environments.host_id.

UPDATE environment_members
SET role = 'CO_HOST'
WHERE role = 'HOST';

ALTER TABLE environment_members
DROP CONSTRAINT IF EXISTS environment_members_role_check;

ALTER TABLE environment_members
ADD CONSTRAINT environment_members_role_check
    CHECK (role IN ('CO_HOST', 'MEMBER'));
