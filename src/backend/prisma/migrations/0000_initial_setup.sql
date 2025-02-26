-- 0000_initial_setup.sql
-- Initial database migration for User Management System

-- Function: Creates UUID extension for PostgreSQL if not exists
CREATE OR REPLACE FUNCTION create_extension_if_not_exists_uuid_ossp()
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
    ) THEN
        CREATE EXTENSION "uuid-ossp";
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Execute extension creation function
SELECT create_extension_if_not_exists_uuid_ossp();

-- Create Role enum type
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'USER', 'GUEST');

-- Create Users table with enhanced security constraints and validation
CREATE TABLE "Users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL CHECK (length(password_hash) >= 60),
    "first_name" VARCHAR(50) NOT NULL CHECK (length(first_name) >= 2),
    "last_name" VARCHAR(50) NOT NULL CHECK (length(last_name) >= 2),
    "role" VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'USER', 'GUEST')),
    "is_active" BOOLEAN DEFAULT TRUE,
    "last_login" TIMESTAMP WITH TIME ZONE,
    "failed_login_attempts" INTEGER DEFAULT 0,
    "lockout_until" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP WITH TIME ZONE
);

-- Create unique index on email
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- Create Sessions table for secure session management
CREATE TABLE "Sessions" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "token" VARCHAR(500) NOT NULL CHECK (length(token) >= 100),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL CHECK (expires_at > created_at),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create AuditLogs table for comprehensive audit logging
CREATE TABLE "AuditLogs" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" VARCHAR(36),
    "changes" JSONB NOT NULL,
    "ip_address" INET,
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function: Creates trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp_trigger()
RETURNS VOID AS $$
BEGIN
    -- Create the function that will update the timestamp
    CREATE OR REPLACE FUNCTION update_timestamp()
    RETURNS TRIGGER AS $trigger$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;

    -- Create the trigger for Users table
    DROP TRIGGER IF EXISTS update_users_timestamp ON "Users";
    CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON "Users"
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
END;
$$ LANGUAGE plpgsql;

-- Function: Creates trigger to automatically remove audit logs older than 90 days
CREATE OR REPLACE FUNCTION create_audit_retention_trigger()
RETURNS VOID AS $$
BEGIN
    -- Create function to delete old audit logs
    CREATE OR REPLACE FUNCTION delete_old_audit_logs()
    RETURNS VOID AS $func$
    BEGIN
        DELETE FROM "AuditLogs" WHERE created_at < NOW() - INTERVAL '90 days';
    END;
    $func$ LANGUAGE plpgsql;

    -- Create function for the trigger
    CREATE OR REPLACE FUNCTION audit_log_cleanup_trigger_func()
    RETURNS TRIGGER AS $trigger$
    BEGIN
        -- Run cleanup function 
        PERFORM delete_old_audit_logs();
        RETURN NULL;
    END;
    $trigger$ LANGUAGE plpgsql;

    -- Create trigger to run daily
    DROP TRIGGER IF EXISTS audit_log_cleanup_trigger ON "AuditLogs";
    CREATE TRIGGER audit_log_cleanup_trigger
    AFTER INSERT ON "AuditLogs"
    FOR EACH STATEMENT
    WHEN (
        (SELECT extract(hour from CURRENT_TIMESTAMP) = 0)
    )
    EXECUTE FUNCTION audit_log_cleanup_trigger_func();

    -- Initial cleanup
    PERFORM delete_old_audit_logs();
END;
$$ LANGUAGE plpgsql;

-- Execute function to create update timestamp trigger
SELECT update_timestamp_trigger();

-- Execute function to create audit retention trigger
SELECT create_audit_retention_trigger();

-- Create indexes for optimized queries
CREATE INDEX "Users_email_idx" ON "Users"("email");
CREATE INDEX "Users_role_created_at_idx" ON "Users"("role", "created_at");
CREATE INDEX "Users_is_active_deleted_at_idx" ON "Users"("is_active", "deleted_at");

CREATE INDEX "Sessions_token_idx" ON "Sessions"("token");
CREATE INDEX "Sessions_user_id_idx" ON "Sessions"("user_id");
CREATE INDEX "Sessions_expires_at_idx" ON "Sessions"("expires_at");

CREATE INDEX "AuditLogs_user_id_idx" ON "AuditLogs"("user_id");
CREATE INDEX "AuditLogs_action_entity_type_idx" ON "AuditLogs"("action", "entity_type");
CREATE INDEX "AuditLogs_entity_type_entity_id_idx" ON "AuditLogs"("entity_type", "entity_id");
CREATE INDEX "AuditLogs_created_at_idx" ON "AuditLogs"("created_at");

-- Create foreign key for AuditLogs.user_id with ON DELETE SET NULL
ALTER TABLE "AuditLogs" DROP CONSTRAINT IF EXISTS "AuditLogs_user_id_fkey";
ALTER TABLE "AuditLogs" ADD CONSTRAINT "AuditLogs_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE SET NULL;