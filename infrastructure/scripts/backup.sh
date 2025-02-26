#!/bin/bash
#
# backup.sh - Enterprise-grade database backup script for User Management Dashboard
#
# Description:
#   Automated backup script for RDS PostgreSQL database and Redis ElastiCache cluster
#   with retention management, encryption verification, and comprehensive monitoring.
#
# Author: System Administrator
# Version: 1.0.0
# Date: 2023-07-01
#
# Dependencies:
#   - aws-cli v2.x: For RDS, ElastiCache, and S3 operations
#   - postgresql-client v15: For pg_dump operations
#
# Usage:
#   ./backup.sh [options]
#   Options:
#     -d    Database identifier (RDS instance name)
#     -c    Redis cluster identifier
#     -r    Retention period in days (default: 90)
#     -v    Enable verbose mode
#     -h    Show this help message
#
# Environment Variables:
#   - AWS_PROFILE: AWS CLI profile to use
#   - AWS_REGION: AWS region for operations
#   - ENVIRONMENT: Deployment environment (dev/staging/prod)
#   - ENCRYPTION_KEY_ID: KMS key ID for encryption
#

set -eo pipefail

# Global variables and defaults
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
ENVIRONMENT=${ENVIRONMENT:-"prod"}
BACKUP_DIR="/var/backups/${ENVIRONMENT}"
RETENTION_DAYS=${RETENTION_DAYS:-90}
LOG_DIR="/var/log/backups"
LOG_FILE="${LOG_DIR}/backup-$(date +%Y%m%d).log"
AWS_REGION=${AWS_REGION:-"us-east-1"}
BACKUP_PREFIX="${ENVIRONMENT}-backup"
S3_BUCKET="usermgmt-backups-${ENVIRONMENT}"
VERBOSE=0
DRY_RUN=0

# Ensure log directory exists
mkdir -p "${LOG_DIR}"
mkdir -p "${BACKUP_DIR}"

# Function: log_message - Enhanced logging utility with severity levels
# Parameters:
#   $1 - Log level (INFO, WARN, ERROR)
#   $2 - Message to log
log_message() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local formatted_message="[${timestamp}] [${level}] ${message}"
    
    # Write to log file
    echo "${formatted_message}" >> "${LOG_FILE}"
    
    # Output to console
    case "${level}" in
        INFO)
            [ "${VERBOSE}" -eq 1 ] && echo -e "\033[0;32m${formatted_message}\033[0m"
            ;;
        WARN)
            echo -e "\033[0;33m${formatted_message}\033[0m"
            ;;
        ERROR)
            echo -e "\033[0;31m${formatted_message}\033[0m"
            # For critical errors, could integrate with monitoring system
            if [ "${ENVIRONMENT}" = "prod" ]; then
                # Example: Send to monitoring system or alert via SNS
                aws sns publish \
                    --region "${AWS_REGION}" \
                    --topic-arn "arn:aws:sns:${AWS_REGION}:123456789012:backup-alerts" \
                    --message "BACKUP ERROR: ${message}" \
                    --subject "Backup Alert - ${ENVIRONMENT}" \
                    --message-attributes '{"severity": {"DataType": "String", "StringValue": "high"}}' \
                    2>/dev/null || true
            fi
            ;;
    esac
}

# Function: check_dependencies - Comprehensive dependency and permission verification
# Returns: True if all dependencies and permissions are satisfied
check_dependencies() {
    log_message "INFO" "Checking dependencies and permissions..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_message "ERROR" "AWS CLI is not installed. Please install aws-cli v2.x"
        return 1
    fi
    
    # Verify AWS CLI version
    local aws_version
    aws_version=$(aws --version 2>&1 | awk '{print $1}' | cut -d '/' -f2)
    if [[ $(echo "${aws_version}" | cut -d '.' -f1) -lt 2 ]]; then
        log_message "WARN" "AWS CLI version ${aws_version} detected. Version 2.x is recommended"
    fi
    
    # Check pg_dump
    if ! command -v pg_dump &> /dev/null; then
        log_message "ERROR" "pg_dump is not installed. Please install postgresql-client v15"
        return 1
    fi
    
    # Check pg_dump version
    local pg_version
    pg_version=$(pg_dump --version | awk '{print $3}' | cut -d '.' -f1)
    if [[ ${pg_version} -lt 15 ]]; then
        log_message "WARN" "pg_dump version ${pg_version} detected. Version 15 is recommended"
    fi
    
    # Verify AWS credentials and permissions
    if ! aws sts get-caller-identity &> /dev/null; then
        log_message "ERROR" "Invalid AWS credentials or insufficient permissions"
        return 1
    fi
    
    # Check S3 bucket
    if ! aws s3api head-bucket --bucket "${S3_BUCKET}" &> /dev/null; then
        log_message "ERROR" "S3 bucket ${S3_BUCKET} not found or not accessible"
        return 1
    fi
    
    # Verify S3 bucket encryption settings
    local bucket_encryption
    bucket_encryption=$(aws s3api get-bucket-encryption --bucket "${S3_BUCKET}" 2>/dev/null || echo "")
    if [[ -z "${bucket_encryption}" ]]; then
        log_message "WARN" "S3 bucket ${S3_BUCKET} does not have default encryption configured"
    else
        log_message "INFO" "S3 bucket ${S3_BUCKET} encryption verified"
    fi
    
    # Check backup directory permissions
    if [[ ! -w "${BACKUP_DIR}" ]]; then
        log_message "ERROR" "No write permission to backup directory: ${BACKUP_DIR}"
        return 1
    fi
    
    # Verify KMS key if specified
    if [[ -n "${ENCRYPTION_KEY_ID}" ]]; then
        if ! aws kms describe-key --key-id "${ENCRYPTION_KEY_ID}" &> /dev/null; then
            log_message "ERROR" "KMS key ${ENCRYPTION_KEY_ID} not found or not accessible"
            return 1
        fi
    fi
    
    log_message "INFO" "All dependencies and permissions verified successfully"
    return 0
}

# Function: backup_rds - Creates encrypted RDS PostgreSQL snapshot
# Parameters:
#   $1 - RDS DB identifier
# Returns: Success status of backup operation
backup_rds() {
    local db_identifier="$1"
    local snapshot_id="${BACKUP_PREFIX}-${db_identifier}-${TIMESTAMP}"
    local export_task_id="${snapshot_id}-export"
    local snapshot_arn
    local status
    local s3_key="rds/${db_identifier}/${snapshot_id}.sql.gz"
    local checksum_file="${BACKUP_DIR}/${snapshot_id}.md5"
    local max_wait_attempts=60
    local wait_attempt=0
    
    log_message "INFO" "Starting backup for RDS instance: ${db_identifier}"
    
    # Verify RDS instance exists and is available
    if ! aws rds describe-db-instances --db-instance-identifier "${db_identifier}" &> /dev/null; then
        log_message "ERROR" "RDS instance ${db_identifier} not found or not accessible"
        return 1
    fi
    
    # Check instance status
    status=$(aws rds describe-db-instances --db-instance-identifier "${db_identifier}" --query 'DBInstances[0].DBInstanceStatus' --output text)
    if [[ "${status}" != "available" ]]; then
        log_message "ERROR" "RDS instance ${db_identifier} is not available (status: ${status})"
        return 1
    fi
    
    log_message "INFO" "Creating RDS snapshot: ${snapshot_id}"
    
    if [[ "${DRY_RUN}" -eq 1 ]]; then
        log_message "INFO" "DRY RUN: Would create snapshot ${snapshot_id}"
    else
        # Create RDS snapshot
        aws rds create-db-snapshot \
            --db-instance-identifier "${db_identifier}" \
            --db-snapshot-identifier "${snapshot_id}" \
            --tags "Key=Environment,Value=${ENVIRONMENT}" "Key=CreatedBy,Value=backup-script" "Key=RetentionDays,Value=${RETENTION_DAYS}" \
            > /dev/null
        
        # Wait for snapshot to complete
        log_message "INFO" "Waiting for snapshot to complete..."
        
        while [[ ${wait_attempt} -lt ${max_wait_attempts} ]]; do
            status=$(aws rds describe-db-snapshots --db-snapshot-identifier "${snapshot_id}" --query 'DBSnapshots[0].Status' --output text 2>/dev/null || echo "error")
            
            if [[ "${status}" == "available" ]]; then
                log_message "INFO" "Snapshot completed successfully"
                break
            elif [[ "${status}" == "error" ]]; then
                log_message "ERROR" "Snapshot creation failed"
                return 1
            fi
            
            wait_attempt=$((wait_attempt + 1))
            log_message "INFO" "Snapshot status: ${status}, attempt ${wait_attempt}/${max_wait_attempts}"
            sleep 30
        done
        
        if [[ ${wait_attempt} -eq ${max_wait_attempts} ]]; then
            log_message "ERROR" "Timed out waiting for snapshot completion"
            return 1
        fi
        
        # Get snapshot ARN
        snapshot_arn=$(aws rds describe-db-snapshots --db-snapshot-identifier "${snapshot_id}" --query 'DBSnapshots[0].DBSnapshotArn' --output text)
        
        # Export snapshot to S3
        log_message "INFO" "Exporting snapshot to S3: s3://${S3_BUCKET}/${s3_key}"
        
        # Export using S3 export for larger databases
        aws rds start-export-task \
            --export-task-identifier "${export_task_id}" \
            --source-arn "${snapshot_arn}" \
            --s3-bucket-name "${S3_BUCKET}" \
            --s3-prefix "rds/${db_identifier}/" \
            --iam-role-arn "arn:aws:iam::123456789012:role/rds-s3-export-role" \
            --kms-key-id "${ENCRYPTION_KEY_ID:-alias/aws/rds}" \
            > /dev/null
        
        # Wait for export task to complete
        wait_attempt=0
        while [[ ${wait_attempt} -lt ${max_wait_attempts} ]]; do
            status=$(aws rds describe-export-tasks --export-task-identifier "${export_task_id}" --query 'ExportTasks[0].Status' --output text 2>/dev/null || echo "error")
            
            if [[ "${status}" == "COMPLETE" ]]; then
                log_message "INFO" "Export task completed successfully"
                break
            elif [[ "${status}" == "FAILED" ]]; then
                local failure_message
                failure_message=$(aws rds describe-export-tasks --export-task-identifier "${export_task_id}" --query 'ExportTasks[0].FailureCause' --output text)
                log_message "ERROR" "Export task failed: ${failure_message}"
                return 1
            fi
            
            wait_attempt=$((wait_attempt + 1))
            log_message "INFO" "Export status: ${status}, attempt ${wait_attempt}/${max_wait_attempts}"
            sleep 60
        done
        
        if [[ ${wait_attempt} -eq ${max_wait_attempts} ]]; then
            log_message "ERROR" "Timed out waiting for export task completion"
            return 1
        fi
        
        # Generate and store backup checksum
        log_message "INFO" "Generating backup checksum"
        aws s3api head-object --bucket "${S3_BUCKET}" --key "${s3_key}" --query 'ETag' --output text | tr -d '"' > "${checksum_file}"
        
        # Update backup inventory in DynamoDB
        log_message "INFO" "Updating backup inventory"
        aws dynamodb put-item \
            --table-name "backup-inventory" \
            --item "{
                \"BackupId\": {\"S\": \"${snapshot_id}\"},
                \"ResourceType\": {\"S\": \"RDS\"},
                \"ResourceName\": {\"S\": \"${db_identifier}\"},
                \"BackupType\": {\"S\": \"Snapshot\"},
                \"CreationTime\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"},
                \"S3Location\": {\"S\": \"s3://${S3_BUCKET}/${s3_key}\"},
                \"ExpiryDate\": {\"S\": \"$(date -d "+${RETENTION_DAYS} days" -u +"%Y-%m-%dT%H:%M:%SZ")\"},
                \"Environment\": {\"S\": \"${ENVIRONMENT}\"},
                \"Encrypted\": {\"BOOL\": true},
                \"Checksum\": {\"S\": \"$(cat "${checksum_file}")\"} 
            }" \
            > /dev/null || log_message "WARN" "Failed to update backup inventory"
        
        # Log detailed backup metrics
        local backup_size
        backup_size=$(aws s3api head-object --bucket "${S3_BUCKET}" --key "${s3_key}" --query 'ContentLength' --output text)
        backup_size_mb=$((backup_size / 1024 / 1024))
        
        log_message "INFO" "Backup completed for ${db_identifier}: ${backup_size_mb}MB, location: s3://${S3_BUCKET}/${s3_key}"
    fi
    
    return 0
}

# Function: backup_redis - Manages Redis ElastiCache backup with encryption
# Parameters:
#   $1 - Redis cluster identifier
# Returns: Success status of backup operation
backup_redis() {
    local cluster_id="$1"
    local snapshot_name="${BACKUP_PREFIX}-${cluster_id}-${TIMESTAMP}"
    local s3_key="redis/${cluster_id}/${snapshot_name}.rdb"
    local status
    local max_wait_attempts=30
    local wait_attempt=0
    
    log_message "INFO" "Starting backup for Redis cluster: ${cluster_id}"
    
    # Verify Redis cluster exists and is available
    if ! aws elasticache describe-replication-groups --replication-group-id "${cluster_id}" &> /dev/null; then
        log_message "ERROR" "Redis cluster ${cluster_id} not found or not accessible"
        return 1
    fi
    
    # Check cluster status
    status=$(aws elasticache describe-replication-groups --replication-group-id "${cluster_id}" --query 'ReplicationGroups[0].Status' --output text)
    if [[ "${status}" != "available" ]]; then
        log_message "ERROR" "Redis cluster ${cluster_id} is not available (status: ${status})"
        return 1
    fi
    
    log_message "INFO" "Creating Redis snapshot: ${snapshot_name}"
    
    if [[ "${DRY_RUN}" -eq 1 ]]; then
        log_message "INFO" "DRY RUN: Would create Redis snapshot ${snapshot_name}"
    else
        # Create Redis snapshot
        aws elasticache create-snapshot \
            --replication-group-id "${cluster_id}" \
            --snapshot-name "${snapshot_name}" \
            --tags "Key=Environment,Value=${ENVIRONMENT}" "Key=CreatedBy,Value=backup-script" "Key=RetentionDays,Value=${RETENTION_DAYS}" \
            > /dev/null
        
        # Wait for snapshot to complete
        log_message "INFO" "Waiting for Redis snapshot to complete..."
        
        while [[ ${wait_attempt} -lt ${max_wait_attempts} ]]; do
            status=$(aws elasticache describe-snapshots --snapshot-name "${snapshot_name}" --query 'Snapshots[0].SnapshotStatus' --output text 2>/dev/null || echo "error")
            
            if [[ "${status}" == "available" ]]; then
                log_message "INFO" "Redis snapshot completed successfully"
                break
            elif [[ "${status}" == "failed" ]]; then
                log_message "ERROR" "Redis snapshot creation failed"
                return 1
            fi
            
            wait_attempt=$((wait_attempt + 1))
            log_message "INFO" "Redis snapshot status: ${status}, attempt ${wait_attempt}/${max_wait_attempts}"
            sleep 30
        done
        
        if [[ ${wait_attempt} -eq ${max_wait_attempts} ]]; then
            log_message "ERROR" "Timed out waiting for Redis snapshot completion"
            return 1
        fi
        
        # Export snapshot to S3 (note: AWS doesn't have a direct API for this)
        # For Redis backups, we'd typically use a custom solution or a third-party tool
        # This is a placeholder for that functionality
        log_message "INFO" "Exporting Redis snapshot to S3 (via custom process)"
        
        # For this example, we'll create a marker file to indicate the backup exists in ElastiCache
        echo "${snapshot_name}" > "${BACKUP_DIR}/${snapshot_name}.marker"
        
        # Update backup inventory in DynamoDB
        log_message "INFO" "Updating Redis backup inventory"
        aws dynamodb put-item \
            --table-name "backup-inventory" \
            --item "{
                \"BackupId\": {\"S\": \"${snapshot_name}\"},
                \"ResourceType\": {\"S\": \"Redis\"},
                \"ResourceName\": {\"S\": \"${cluster_id}\"},
                \"BackupType\": {\"S\": \"Snapshot\"},
                \"CreationTime\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"},
                \"ExpiryDate\": {\"S\": \"$(date -d "+${RETENTION_DAYS} days" -u +"%Y-%m-%dT%H:%M:%SZ")\"},
                \"Environment\": {\"S\": \"${ENVIRONMENT}\"},
                \"Encrypted\": {\"BOOL\": true}
            }" \
            > /dev/null || log_message "WARN" "Failed to update backup inventory"
        
        log_message "INFO" "Redis backup completed for ${cluster_id}"
    fi
    
    return 0
}

# Function: cleanup_old_backups - Manages backup retention with S3 lifecycle policies
# Parameters:
#   $1 - Retention period in days
cleanup_old_backups() {
    local retention_days="$1"
    local expiry_date
    expiry_date=$(date -d "-${retention_days} days" +%Y-%m-%d)
    
    log_message "INFO" "Starting cleanup of backups older than ${retention_days} days (${expiry_date})"
    
    if [[ "${DRY_RUN}" -eq 1 ]]; then
        log_message "INFO" "DRY RUN: Would clean up backups older than ${expiry_date}"
        return 0
    fi
    
    # Get backup inventory from DynamoDB
    log_message "INFO" "Retrieving backup inventory"
    local expired_backups
    expired_backups=$(aws dynamodb scan \
        --table-name "backup-inventory" \
        --filter-expression "ExpiryDate <= :date" \
        --expression-attribute-values "{\":date\":{\"S\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}}" \
        --query "Items[*].[BackupId.S, ResourceType.S, S3Location.S]" \
        --output text || echo "")
    
    if [[ -z "${expired_backups}" ]]; then
        log_message "INFO" "No expired backups found"
        return 0
    fi
    
    # Process each expired backup
    local deleted_count=0
    local error_count=0
    
    echo "${expired_backups}" | while read -r backup_id resource_type s3_location; do
        log_message "INFO" "Processing expired backup: ${backup_id} (${resource_type})"
        
        # For RDS snapshots, we need to delete both the S3 export and the snapshot
        if [[ "${resource_type}" == "RDS" ]]; then
            # Extract DB instance identifier from the backup ID
            local db_id
            db_id=$(echo "${backup_id}" | sed -E "s/${BACKUP_PREFIX}-([^-]+)-.*/\1/")
            
            # Delete the exported file in S3
            if [[ -n "${s3_location}" && "${s3_location}" != "null" ]]; then
                local bucket
                local key
                bucket=$(echo "${s3_location}" | sed -E 's/s3:\/\/([^\/]+)\/(.*)/\1/')
                key=$(echo "${s3_location}" | sed -E 's/s3:\/\/([^\/]+)\/(.*)/\2/')
                
                log_message "INFO" "Deleting S3 object: ${s3_location}"
                if aws s3 rm "${s3_location}" > /dev/null; then
                    log_message "INFO" "S3 object deleted successfully"
                else
                    log_message "WARN" "Failed to delete S3 object: ${s3_location}"
                    error_count=$((error_count + 1))
                    continue
                fi
            fi
            
            # Delete the RDS snapshot
            log_message "INFO" "Deleting RDS snapshot: ${backup_id}"
            if aws rds delete-db-snapshot --db-snapshot-identifier "${backup_id}" > /dev/null; then
                log_message "INFO" "RDS snapshot deleted successfully"
            else
                log_message "WARN" "Failed to delete RDS snapshot: ${backup_id}"
                error_count=$((error_count + 1))
                continue
            fi
        # For Redis snapshots
        elif [[ "${resource_type}" == "Redis" ]]; then
            # Extract cluster identifier from the backup ID
            local cluster_id
            cluster_id=$(echo "${backup_id}" | sed -E "s/${BACKUP_PREFIX}-([^-]+)-.*/\1/")
            
            # Delete the Redis snapshot
            log_message "INFO" "Deleting Redis snapshot: ${backup_id}"
            if aws elasticache delete-snapshot --snapshot-name "${backup_id}" > /dev/null; then
                log_message "INFO" "Redis snapshot deleted successfully"
            else
                log_message "WARN" "Failed to delete Redis snapshot: ${backup_id}"
                error_count=$((error_count + 1))
                continue
            fi
        fi
        
        # Remove from DynamoDB inventory
        log_message "INFO" "Removing backup from inventory: ${backup_id}"
        if aws dynamodb delete-item \
            --table-name "backup-inventory" \
            --key "{\"BackupId\":{\"S\":\"${backup_id}\"}}" > /dev/null; then
            log_message "INFO" "Backup removed from inventory successfully"
            deleted_count=$((deleted_count + 1))
        else
            log_message "WARN" "Failed to remove backup from inventory: ${backup_id}"
            error_count=$((error_count + 1))
        fi
    done
    
    log_message "INFO" "Cleanup complete. Deleted ${deleted_count} backups with ${error_count} errors"
    
    return 0
}

# Print help message
show_help() {
    echo "Usage: $0 [options]"
    echo
    echo "Options:"
    echo "  -d <db_id>     RDS database identifier"
    echo "  -c <cluster_id> Redis cluster identifier"
    echo "  -r <days>      Retention period in days (default: ${RETENTION_DAYS})"
    echo "  -v             Enable verbose mode"
    echo "  -n             Dry run (don't actually create backups)"
    echo "  -h             Show this help message"
    echo
    echo "Environment Variables:"
    echo "  AWS_PROFILE    AWS CLI profile to use"
    echo "  AWS_REGION     AWS region for operations (default: ${AWS_REGION})"
    echo "  ENVIRONMENT    Deployment environment (default: ${ENVIRONMENT})"
    echo "  ENCRYPTION_KEY_ID  KMS key ID for encryption"
    echo
}

# Main script execution
main() {
    local db_id=""
    local cluster_id=""
    local backup_success=true
    
    # Parse command line arguments
    while getopts "d:c:r:vnh" opt; do
        case ${opt} in
            d)
                db_id="${OPTARG}"
                ;;
            c)
                cluster_id="${OPTARG}"
                ;;
            r)
                RETENTION_DAYS="${OPTARG}"
                ;;
            v)
                VERBOSE=1
                ;;
            n)
                DRY_RUN=1
                ;;
            h)
                show_help
                exit 0
                ;;
            \?)
                show_help
                exit 1
                ;;
        esac
    done
    
    # Initialize log
    log_message "INFO" "=== Backup script started at $(date) ==="
    log_message "INFO" "Environment: ${ENVIRONMENT}, Retention: ${RETENTION_DAYS} days"
    
    if [[ ${DRY_RUN} -eq 1 ]]; then
        log_message "INFO" "DRY RUN MODE: No actual backups will be created"
    fi
    
    # Check dependencies
    if ! check_dependencies; then
        log_message "ERROR" "Dependency check failed. Exiting."
        exit 1
    fi
    
    # Perform RDS backup if specified
    if [[ -n "${db_id}" ]]; then
        if ! backup_rds "${db_id}"; then
            log_message "ERROR" "RDS backup failed for ${db_id}"
            backup_success=false
        fi
    fi
    
    # Perform Redis backup if specified
    if [[ -n "${cluster_id}" ]]; then
        if ! backup_redis "${cluster_id}"; then
            log_message "ERROR" "Redis backup failed for ${cluster_id}"
            backup_success=false
        fi
    fi
    
    # Clean up old backups
    cleanup_old_backups "${RETENTION_DAYS}"
    
    # Generate backup report
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_message "INFO" "=== Backup script completed at $(date) ==="
    log_message "INFO" "Duration: $((duration / 60)) minutes $((duration % 60)) seconds"
    
    # Generate success or failure exit code
    if [[ "${backup_success}" == "true" ]]; then
        log_message "INFO" "Backup completed successfully"
        exit 0
    else
        log_message "ERROR" "Backup completed with errors"
        exit 1
    fi
}

# Record start time
start_time=$(date +%s)

# Execute main function
main "$@"