#!/bin/bash
#
# monitoring.sh - Comprehensive system monitoring and health checks
# 
# This script provides advanced monitoring capabilities for the User Management Dashboard
# infrastructure, integrating with CloudWatch, Prometheus, and ELK Stack for metrics
# collection, alerting, and log aggregation.
#
# Features:
# - Service health checking with dependency verification
# - Metrics collection from multiple sources with aggregation
# - Log shipping with format validation and rotation
# - Alert management with correlation and prioritization
#
# Usage: ./monitoring.sh [options]
#   Options:
#     --health-check       Run health checks on all services
#     --collect-metrics    Collect and aggregate metrics
#     --ship-logs          Ship logs to ELK Stack
#     --check-alerts       Check and correlate alerts
#     --all                Run all monitoring operations (default)
#
# Version: 1.0.0
# Author: System Administration Team

# Set strict mode
set -euo pipefail

# Define global variables
PROMETHEUS_ENDPOINT="${PROMETHEUS_ENDPOINT:-http://localhost:9090}"
ELASTICSEARCH_HOST="${ELASTICSEARCH_HOST:-http://elasticsearch:9200}"
CLOUDWATCH_NAMESPACE="${CLOUDWATCH_NAMESPACE:-UserManagementDashboard}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-90}"
ALERT_CORRELATION_WINDOW="${ALERT_CORRELATION_WINDOW:-300}"
METRIC_SAMPLE_RATE="${METRIC_SAMPLE_RATE:-0.1}"
MAX_RETRY_ATTEMPTS="${MAX_RETRY_ATTEMPTS:-3}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-30}"

# Define LOG_FORMAT (imported from logger.config.ts)
# Using the same format to maintain consistency
LOG_FORMAT_JSON=true
LOG_FORMAT_TIMESTAMP=true
LOG_FORMAT_COLORIZE=false
LOG_FORMAT_SERVICE="user-management-dashboard"
LOG_FORMAT_ENVIRONMENT="${NODE_ENV:-production}"

# Initialize monitoring status
monitoring_status=0
health_status="{}"
metrics_summary="{}"

# ================================================================================
# Utility Functions
# ================================================================================

# Enhanced logging function with timestamp and JSON formatting
log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    if [[ "$LOG_FORMAT_JSON" == "true" ]]; then
        # JSON formatted log - matching the format in logger.config.ts
        local log_data
        log_data=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "level": "$level",
  "message": "$message",
  "service": "$LOG_FORMAT_SERVICE",
  "environment": "$LOG_FORMAT_ENVIRONMENT"
}
EOF
)
        echo "$log_data"
    else
        # Simple formatted log
        if [[ "$LOG_FORMAT_COLORIZE" == "true" && -t 1 ]]; then
            case "$level" in
                "ERROR") echo -e "\e[31m[$timestamp] ERROR: $message\e[0m" ;;
                "WARN")  echo -e "\e[33m[$timestamp] WARN: $message\e[0m" ;;
                "INFO")  echo -e "\e[32m[$timestamp] INFO: $message\e[0m" ;;
                "DEBUG") echo -e "\e[34m[$timestamp] DEBUG: $message\e[0m" ;;
                *)       echo -e "[$timestamp] $level: $message" ;;
            esac
        else
            echo "[$timestamp] $level: $message"
        fi
    fi
}

# Error handling function
handle_error() {
    local exit_code=$1
    local error_message=$2
    log "ERROR" "$error_message"
    monitoring_status=$exit_code
    exit "$exit_code"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    # Check for core dependencies
    for dep in curl jq aws; do
        if ! command_exists "$dep"; then
            missing_deps+=("$dep")
        fi
    done
    
    # Check for additional dependencies based on operations
    if [[ "$run_metrics" == "true" ]]; then
        if ! command_exists "prometheus"; then
            missing_deps+=("prometheus-client")
        fi
    fi
    
    if [[ "$run_logs" == "true" ]]; then
        if ! command_exists "filebeat"; then
            missing_deps+=("filebeat")
        fi
    fi
    
    # If missing dependencies, report them
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        handle_error 1 "Missing dependencies: ${missing_deps[*]}"
    fi
}

# ================================================================================
# Service Health Check Function
# ================================================================================

# Enhanced service health check with dependency verification
check_service_health() {
    local service_name="$1"
    local retry_count="${2:-$MAX_RETRY_ATTEMPTS}"
    local timeout_seconds="${3:-$HEALTH_CHECK_TIMEOUT}"
    local attempt=1
    local status_code=0
    local response=""
    local health_result="{}"
    
    log "INFO" "Checking health for service: $service_name (timeout: ${timeout_seconds}s, retries: $retry_count)"
    
    # Service health endpoints mapping
    local endpoint=""
    case "$service_name" in
        "api") endpoint="http://api-service:3000/health" ;;
        "auth") endpoint="http://auth-service:3001/health" ;;
        "db") endpoint="http://db-service:5432/health" ;;
        "cache") endpoint="http://cache-service:6379/health" ;;
        "all") 
            # Check all services
            local all_services=("api" "auth" "db" "cache")
            local all_healthy=true
            local service_results=()
            
            for svc in "${all_services[@]}"; do
                local svc_result
                svc_result=$(check_service_health "$svc" "$retry_count" "$timeout_seconds")
                service_results+=("\"$svc\": $svc_result")
                
                if [[ $(echo "$svc_result" | jq -r '.status') != "healthy" ]]; then
                    all_healthy=false
                fi
            done
            
            # Construct the combined health result
            local status="healthy"
            if [[ "$all_healthy" != "true" ]]; then
                status="unhealthy"
                monitoring_status=1
            fi
            
            health_result="{\"status\":\"$status\",\"services\":{${service_results[*]}}}"
            echo "$health_result"
            return
            ;;
        *) 
            log "ERROR" "Unknown service: $service_name"
            health_result="{\"status\":\"unknown\",\"error\":\"Unknown service: $service_name\"}"
            echo "$health_result"
            return 1
            ;;
    esac
    
    # Perform health check with retry logic
    while [[ $attempt -le $retry_count ]]; do
        log "DEBUG" "Health check attempt $attempt for $service_name"
        
        # Check service dependencies first (if applicable)
        local dependencies_healthy=true
        local dependency_status="{}"
        
        case "$service_name" in
            "api")
                # API depends on auth, db, and cache
                dependency_status=$(check_dependencies_health "auth" "db" "cache")
                if [[ $(echo "$dependency_status" | jq -r '.healthy') != "true" ]]; then
                    dependencies_healthy=false
                fi
                ;;
            "auth")
                # Auth depends on db
                dependency_status=$(check_dependencies_health "db")
                if [[ $(echo "$dependency_status" | jq -r '.healthy') != "true" ]]; then
                    dependencies_healthy=false
                fi
                ;;
        esac
        
        if [[ "$dependencies_healthy" != "true" ]]; then
            log "WARN" "Dependencies unhealthy for $service_name: $(echo "$dependency_status" | jq -c)"
            
            # If this is the last attempt, report dependency failure
            if [[ $attempt -eq $retry_count ]]; then
                health_result="{\"status\":\"unhealthy\",\"error\":\"Dependencies unhealthy\",\"dependencies\":$dependency_status}"
                monitoring_status=1
                echo "$health_result"
                return 1
            fi
            
            # Otherwise, retry after exponential backoff
            sleep $((2 ** (attempt - 1)))
            ((attempt++))
            continue
        fi
        
        # If dependencies are healthy, check the service itself
        response=$(curl -s -w "%{http_code}" -m "$timeout_seconds" "$endpoint" 2>/dev/null) || status_code=$?
        
        # Extract HTTP status code and response body
        local http_code=${response: -3}
        local body=${response:0:${#response}-3}
        
        if [[ $status_code -eq 0 && "$http_code" == "200" ]]; then
            # Validate response format
            if echo "$body" | jq -e . >/dev/null 2>&1; then
                local service_status
                service_status=$(echo "$body" | jq -r '.status // "unknown"')
                
                if [[ "$service_status" == "healthy" ]]; then
                    log "INFO" "Service $service_name is healthy"
                    health_result="{\"status\":\"healthy\",\"details\":$body,\"dependencies\":$dependency_status}"
                    echo "$health_result"
                    return 0
                else
                    log "WARN" "Service $service_name reported unhealthy status: $service_status"
                fi
            else
                log "WARN" "Service $service_name returned invalid JSON response"
            fi
        else
            log "WARN" "Service $service_name health check failed: HTTP $http_code, status code $status_code"
        fi
        
        # If this is the last attempt, report failure
        if [[ $attempt -eq $retry_count ]]; then
            health_result="{\"status\":\"unhealthy\",\"error\":\"Health check failed after $retry_count attempts\",\"last_status_code\":$status_code,\"last_http_code\":\"$http_code\",\"dependencies\":$dependency_status}"
            monitoring_status=1
            echo "$health_result"
            return 1
        fi
        
        # Exponential backoff before retry
        sleep $((2 ** (attempt - 1)))
        ((attempt++))
    done
    
    # Should not reach here, but just in case
    health_result="{\"status\":\"unknown\",\"error\":\"Unexpected error during health check\"}"
    monitoring_status=1
    echo "$health_result"
    return 1
}

# Helper function to check dependencies health
check_dependencies_health() {
    local deps=("$@")
    local all_healthy=true
    local results=()
    
    for dep in "${deps[@]}"; do
        local dep_health
        dep_health=$(curl -s "http://$dep-service/health" 2>/dev/null || echo '{"status":"unreachable"}')
        local dep_status
        dep_status=$(echo "$dep_health" | jq -r '.status // "unknown"')
        
        results+=("\"$dep\": {\"status\":\"$dep_status\"}")
        
        if [[ "$dep_status" != "healthy" ]]; then
            all_healthy=false
        fi
    done
    
    echo "{\"healthy\":$all_healthy,\"details\":{${results[*]}}}"
}

# ================================================================================
# Metrics Collection Function
# ================================================================================

# Advanced metrics collection with support for custom metrics and aggregation
collect_metrics() {
    local metric_type="$1"
    local collection_config="$2"
    local metrics_data="{}"
    
    log "INFO" "Collecting metrics of type: $metric_type"
    
    case "$metric_type" in
        "system")
            # Collect system metrics from CloudWatch
            collect_system_metrics "$collection_config"
            ;;
        "application")
            # Collect application metrics from Prometheus
            collect_application_metrics "$collection_config"
            ;;
        "custom")
            # Collect custom metrics
            collect_custom_metrics "$collection_config"
            ;;
        "all")
            # Collect all metrics
            collect_system_metrics "{}"
            collect_application_metrics "{}"
            collect_custom_metrics "{}"
            ;;
        *)
            log "ERROR" "Unknown metric type: $metric_type"
            return 1
            ;;
    esac
    
    # Aggregate metrics from all sources
    metrics_summary=$(aggregate_metrics)
    echo "$metrics_summary"
}

# Collect system metrics from CloudWatch
collect_system_metrics() {
    local config="$1"
    local period=$(echo "$config" | jq -r '.period // 300')
    local start_time=$(echo "$config" | jq -r '.start_time // "-1h"')
    local metrics=()
    
    log "INFO" "Collecting system metrics from CloudWatch (period: ${period}s, start time: $start_time)"
    
    # Define core system metrics
    local metric_names=(
        "CPUUtilization"
        "MemoryUtilization"
        "NetworkIn"
        "NetworkOut"
        "DiskUtilization"
    )
    
    for metric_name in "${metric_names[@]}"; do
        log "DEBUG" "Collecting CloudWatch metric: $metric_name"
        
        local metric_data
        # Use AWS CLI to get metric data
        if ! metric_data=$(aws cloudwatch get-metric-data \
            --namespace "$CLOUDWATCH_NAMESPACE" \
            --metric-name "$metric_name" \
            --dimensions "Name=ServiceName,Value=UserManagementDashboard" \
            --start-time "$start_time" \
            --end-time "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
            --period "$period" \
            --statistics "Average" "Maximum" "Minimum" \
            --output json 2>/dev/null); then
            
            log "WARN" "Failed to collect CloudWatch metric: $metric_name"
            metric_data="{\"status\":\"error\",\"message\":\"Failed to collect CloudWatch metric\"}"
        fi
        
        metrics+=("\"$metric_name\": $metric_data")
    done
    
    # Store the collected metrics
    echo "{${metrics[*]}}" > /tmp/system_metrics.json
    log "INFO" "System metrics collection completed"
}

# Collect application metrics from Prometheus
collect_application_metrics() {
    local config="$1"
    local metrics=()
    
    log "INFO" "Collecting application metrics from Prometheus endpoint: $PROMETHEUS_ENDPOINT"
    
    # Define core application metrics
    local metric_queries=(
        "http_request_duration_seconds"
        "http_request_total"
        "http_error_total"
        "api_latency"
        "database_query_duration_seconds"
        "cache_hit_ratio"
        "active_users"
        "auth_failures"
    )
    
    for query in "${metric_queries[@]}"; do
        log "DEBUG" "Executing Prometheus query: $query"
        
        local metric_data
        # Query Prometheus API
        if ! metric_data=$(curl -s "$PROMETHEUS_ENDPOINT/api/v1/query?query=$query" 2>/dev/null); then
            log "WARN" "Failed to collect Prometheus metric: $query"
            metric_data="{\"status\":\"error\",\"message\":\"Failed to collect Prometheus metric\"}"
        fi
        
        metrics+=("\"$query\": $metric_data")
    done
    
    # Store the collected metrics
    echo "{${metrics[*]}}" > /tmp/application_metrics.json
    log "INFO" "Application metrics collection completed"
}

# Collect custom application-specific metrics
collect_custom_metrics() {
    local config="$1"
    local metrics=()
    
    log "INFO" "Collecting custom application metrics"
    
    # Define custom metric collection logic
    # Example: API response time by endpoint
    if command_exists "curl"; then
        local endpoints=(
            "/api/v1/users"
            "/api/v1/auth/login"
            "/health"
        )
        
        for endpoint in "${endpoints[@]}"; do
            log "DEBUG" "Measuring response time for endpoint: $endpoint"
            
            local start_time
            local end_time
            local response_time
            local status_code
            
            start_time=$(date +%s.%N)
            status_code=$(curl -s -o /dev/null -w "%{http_code}" "http://api-service:3000$endpoint" 2>/dev/null || echo "0")
            end_time=$(date +%s.%N)
            
            response_time=$(echo "$end_time - $start_time" | bc)
            metrics+=("\"$endpoint\": {\"response_time\":$response_time,\"status_code\":$status_code}")
        done
    fi
    
    # Example: Database connection pool stats
    if command_exists "psql"; then
        local db_stats
        db_stats=$(psql -h db-service -c "SELECT count(*) as active_connections FROM pg_stat_activity" -t 2>/dev/null || echo "0")
        metrics+=("\"database_connections\": {\"active\":$db_stats}")
    fi
    
    # Example: Cache hit rate
    if command_exists "redis-cli"; then
        local cache_info
        cache_info=$(redis-cli -h cache-service info stats 2>/dev/null | grep -E 'keyspace_hits|keyspace_misses' || echo "")
        local hits
        local misses
        hits=$(echo "$cache_info" | grep 'keyspace_hits' | cut -d ':' -f2 || echo "0")
        misses=$(echo "$cache_info" | grep 'keyspace_misses' | cut -d ':' -f2 || echo "0")
        local hit_rate=0
        
        if [[ "$hits" != "0" || "$misses" != "0" ]]; then
            hit_rate=$(echo "scale=2; $hits / ($hits + $misses) * 100" | bc)
        fi
        
        metrics+=("\"cache_statistics\": {\"hit_rate\":$hit_rate,\"hits\":$hits,\"misses\":$misses}")
    fi
    
    # Store the collected metrics
    echo "{${metrics[*]}}" > /tmp/custom_metrics.json
    log "INFO" "Custom metrics collection completed"
}

# Aggregate and analyze metrics from all sources
aggregate_metrics() {
    log "INFO" "Aggregating metrics from all sources"
    
    local system_metrics="{}"
    local application_metrics="{}"
    local custom_metrics="{}"
    
    # Load collected metrics if they exist
    [[ -f /tmp/system_metrics.json ]] && system_metrics=$(<"/tmp/system_metrics.json")
    [[ -f /tmp/application_metrics.json ]] && application_metrics=$(<"/tmp/application_metrics.json")
    [[ -f /tmp/custom_metrics.json ]] && custom_metrics=$(<"/tmp/custom_metrics.json")
    
    # Compute aggregated statistics
    local cpu_utilization
    cpu_utilization=$(echo "$system_metrics" | jq -r '.CPUUtilization.MetricDataResults[0].Values[0] // 0')
    
    local memory_utilization
    memory_utilization=$(echo "$system_metrics" | jq -r '.MemoryUtilization.MetricDataResults[0].Values[0] // 0')
    
    local request_rate
    request_rate=$(echo "$application_metrics" | jq -r '.http_request_total.data.result[0].value[1] // 0')
    
    local error_rate
    error_rate=$(echo "$application_metrics" | jq -r '.http_error_total.data.result[0].value[1] // 0')
    
    local api_latency
    api_latency=$(echo "$application_metrics" | jq -r '.api_latency.data.result[0].value[1] // 0')
    
    # Calculate derived metrics
    local error_percentage=0
    if [[ "$request_rate" != "0" && "$error_rate" != "0" ]]; then
        error_percentage=$(echo "scale=2; $error_rate / $request_rate * 100" | bc)
    fi
    
    # Determine system health based on metrics
    local health_status="healthy"
    local health_issues=()
    
    if (( $(echo "$cpu_utilization > 80" | bc -l) )); then
        health_status="warning"
        health_issues+=("\"high_cpu_utilization\"")
    fi
    
    if (( $(echo "$memory_utilization > 85" | bc -l) )); then
        health_status="warning"
        health_issues+=("\"high_memory_utilization\"")
    fi
    
    if (( $(echo "$error_percentage > 5" | bc -l) )); then
        health_status="warning"
        health_issues+=("\"high_error_rate\"")
    fi
    
    if (( $(echo "$api_latency > 1.0" | bc -l) )); then
        health_status="warning"
        health_issues+=("\"high_api_latency\"")
    fi
    
    # Return the aggregated metrics summary
    echo "{
        \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
        \"health_status\": \"$health_status\",
        \"health_issues\": [${health_issues[*]}],
        \"metrics\": {
            \"cpu_utilization\": $cpu_utilization,
            \"memory_utilization\": $memory_utilization,
            \"request_rate\": $request_rate,
            \"error_rate\": $error_rate,
            \"error_percentage\": $error_percentage,
            \"api_latency\": $api_latency
        },
        \"raw\": {
            \"system\": $system_metrics,
            \"application\": $application_metrics,
            \"custom\": $custom_metrics
        }
    }"
}

# ================================================================================
# Log Shipping Function
# ================================================================================

# Enhanced log shipping with format validation and rotation
ship_logs() {
    local log_pattern="$1"
    local shipping_config="$2"
    local shipping_result="{}"
    
    log "INFO" "Shipping logs with pattern: $log_pattern"
    
    # Default config values
    local rotation_enabled=$(echo "$shipping_config" | jq -r '.rotation.enabled // true')
    local max_size=$(echo "$shipping_config" | jq -r '.rotation.max_size // "100M"')
    local max_files=$(echo "$shipping_config" | jq -r '.rotation.max_files // 10')
    local retention_days=${LOG_RETENTION_DAYS}
    
    # Validate log format for applicable logs
    if [[ "$log_pattern" == *".json"* ]]; then
        log "DEBUG" "Validating JSON log format"
        validate_json_logs "$log_pattern"
    fi
    
    # Apply log rotation if enabled
    if [[ "$rotation_enabled" == "true" ]]; then
        log "DEBUG" "Applying log rotation"
        rotate_logs "$log_pattern" "$max_size" "$max_files"
    fi
    
    # Ship logs to ELK Stack using Filebeat
    if command_exists "filebeat"; then
        log "INFO" "Shipping logs to ELK Stack using Filebeat"
        
        # Create temporary Filebeat configuration
        local filebeat_config="/tmp/filebeat_$(date +%s).yml"
        cat > "$filebeat_config" << EOF
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - $log_pattern
  json.keys_under_root: true
  json.add_error_key: true
  processors:
    - add_host_metadata: ~
    - add_cloud_metadata: ~
    - add_docker_metadata: ~
    - add_kubernetes_metadata: ~

output.elasticsearch:
  hosts: ["$ELASTICSEARCH_HOST"]
  index: "user-management-logs-%{+yyyy.MM.dd}"

setup.ilm.enabled: true
setup.ilm.rollover_alias: "user-management-logs"
setup.ilm.pattern: "{now/d}-000001"
setup.ilm.policy_name: "user-management-logs-policy"
EOF
        
        # Run Filebeat with the temporary configuration
        if ! filebeat -e -c "$filebeat_config" -once >/dev/null 2>&1; then
            log "ERROR" "Failed to ship logs using Filebeat"
            shipping_result="{\"status\":\"error\",\"message\":\"Failed to ship logs using Filebeat\"}"
            return 1
        else
            log "INFO" "Successfully shipped logs to ELK Stack"
            shipping_result="{\"status\":\"success\",\"message\":\"Successfully shipped logs to ELK Stack\",\"pattern\":\"$log_pattern\"}"
        fi
        
        # Clean up temporary configuration
        rm -f "$filebeat_config"
    else
        # Fallback to direct Elasticsearch API if Filebeat is not available
        log "WARN" "Filebeat not available, using direct Elasticsearch API"
        
        # Find files matching the pattern
        local log_files
        log_files=$(find "$(dirname "$log_pattern")" -name "$(basename "$log_pattern")" -type f)
        
        local files_processed=0
        local files_failed=0
        
        for file in $log_files; do
            log "DEBUG" "Shipping log file: $file"
            
            if [[ -f "$file" && -r "$file" ]]; then
                # Check if file is valid JSON (for JSON logs)
                if [[ "$file" == *".json"* ]] && ! jq -e . "$file" >/dev/null 2>&1; then
                    log "WARN" "Skipping invalid JSON log file: $file"
                    ((files_failed++))
                    continue
                fi
                
                # Ship the file directly to Elasticsearch
                local index_name="user-management-logs-$(date +%Y.%m.%d)"
                local curl_result
                
                curl_result=$(curl -s -X POST "$ELASTICSEARCH_HOST/$index_name/_bulk" \
                    -H "Content-Type: application/x-ndjson" \
                    --data-binary "@$file" 2>/dev/null)
                
                if echo "$curl_result" | jq -e '.errors' >/dev/null 2>&1 && [[ "$(echo "$curl_result" | jq -r '.errors')" == "true" ]]; then
                    log "WARN" "Error shipping log file $file: $(echo "$curl_result" | jq -c '.items[0].index.error // "Unknown error"')"
                    ((files_failed++))
                else
                    log "DEBUG" "Successfully shipped log file: $file"
                    ((files_processed++))
                fi
            else
                log "WARN" "Cannot read log file: $file"
                ((files_failed++))
            fi
        done
        
        # Report shipping results
        if [[ $files_processed -gt 0 ]]; then
            log "INFO" "Successfully shipped $files_processed log files to ELK Stack ($files_failed failed)"
            shipping_result="{\"status\":\"success\",\"message\":\"Successfully shipped logs to ELK Stack\",\"files_processed\":$files_processed,\"files_failed\":$files_failed}"
        else
            log "WARN" "No log files were successfully shipped"
            shipping_result="{\"status\":\"warning\",\"message\":\"No log files were successfully shipped\",\"files_processed\":0,\"files_failed\":$files_failed}"
        fi
    fi
    
    # Apply retention policy (delete old logs)
    if [[ -n "$retention_days" && "$retention_days" -gt 0 ]]; then
        log "DEBUG" "Applying retention policy: $retention_days days"
        find "$(dirname "$log_pattern")" -name "$(basename "$log_pattern" | sed 's/\*/.*/')" -type f -mtime +"$retention_days" -delete
    fi
    
    echo "$shipping_result"
}

# Validate JSON log format
validate_json_logs() {
    local log_pattern="$1"
    log "DEBUG" "Validating JSON logs: $log_pattern"
    
    # Find the JSON log files
    local log_files
    log_files=$(find "$(dirname "$log_pattern")" -name "$(basename "$log_pattern")" -type f)
    
    for file in $log_files; do
        if [[ -f "$file" && -r "$file" ]]; then
            # Check if the file contains valid JSON objects
            if ! jq -e . "$file" >/dev/null 2>&1; then
                log "WARN" "Invalid JSON format in log file: $file"
                
                # Attempt to fix common JSON issues
                log "DEBUG" "Attempting to fix JSON format in: $file"
                local fixed_file="${file}.fixed"
                
                # Add missing commas, fix trailing commas, etc.
                cat "$file" | sed -E 's/}(\s*){/},\1{/g' > "$fixed_file"
                
                # Check if the fix worked
                if jq -e . "$fixed_file" >/dev/null 2>&1; then
                    log "INFO" "Successfully fixed JSON format in: $file"
                    mv "$fixed_file" "$file"
                else
                    log "WARN" "Could not fix JSON format in: $file"
                    rm -f "$fixed_file"
                fi
            else
                log "DEBUG" "Valid JSON format in log file: $file"
            fi
        fi
    done
}

# Rotate logs based on size
rotate_logs() {
    local log_pattern="$1"
    local max_size="$2"
    local max_files="$3"
    
    log "DEBUG" "Rotating logs: $log_pattern (max size: $max_size, max files: $max_files)"
    
    # Convert max_size to bytes
    local max_bytes
    if [[ "$max_size" =~ ^([0-9]+)([KMG])$ ]]; then
        local size="${BASH_REMATCH[1]}"
        local unit="${BASH_REMATCH[2]}"
        
        case "$unit" in
            K) max_bytes=$((size * 1024)) ;;
            M) max_bytes=$((size * 1024 * 1024)) ;;
            G) max_bytes=$((size * 1024 * 1024 * 1024)) ;;
            *) max_bytes=$size ;;
        esac
    else
        max_bytes=$((100 * 1024 * 1024))  # Default to 100MB
    fi
    
    # Find log files
    local log_files
    log_files=$(find "$(dirname "$log_pattern")" -name "$(basename "$log_pattern")" -type f)
    
    for file in $log_files; do
        if [[ -f "$file" && -r "$file" ]]; then
            local file_size
            file_size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
            
            if [[ -n "$file_size" && "$file_size" -gt "$max_bytes" ]]; then
                log "INFO" "Rotating log file: $file (size: $file_size bytes, max: $max_bytes bytes)"
                
                # Create rotation filename with timestamp
                local timestamp
                timestamp=$(date +%Y%m%d-%H%M%S)
                local rotated_file="${file}.${timestamp}"
                
                # Rotate the file
                mv "$file" "$rotated_file"
                touch "$file"  # Create empty file to continue logging
                
                # Compress the rotated file
                gzip "$rotated_file" &
                
                # Cleanup old rotated files if needed
                if [[ -n "$max_files" && "$max_files" -gt 0 ]]; then
                    local old_files
                    old_files=$(find "$(dirname "$file")" -name "$(basename "$file").*" -type f | sort -r | tail -n +$((max_files + 1)))
                    
                    if [[ -n "$old_files" ]]; then
                        echo "$old_files" | xargs rm -f
                    fi
                fi
            fi
        fi
    done
}

# ================================================================================
# Alert Management Function
# ================================================================================

# Comprehensive alert management with correlation and prioritization
check_alerts() {
    local alert_type="$1"
    local alert_config="$2"
    local alerts_result="{}"
    
    log "INFO" "Checking alerts of type: $alert_type"
    
    # Default config values
    local correlation_window=${ALERT_CORRELATION_WINDOW}
    local alert_sources=$(echo "$alert_config" | jq -r '.sources // ["cloudwatch", "prometheus"]' | tr -d '[]' | tr ',' ' ')
    
    # Collect alerts from different sources
    local all_alerts=()
    
    for source in $alert_sources; do
        log "DEBUG" "Collecting alerts from source: $source"
        
        local source_alerts
        case "$source" in
            "cloudwatch")
                source_alerts=$(collect_cloudwatch_alerts)
                ;;
            "prometheus")
                source_alerts=$(collect_prometheus_alerts)
                ;;
            *)
                log "WARN" "Unknown alert source: $source"
                source_alerts="[]"
                ;;
        esac
        
        # Append source alerts to all alerts
        if [[ "$source_alerts" != "[]" ]]; then
            all_alerts+=("$source_alerts")
        fi
    done
    
    # Combine all alerts into a single array
    local combined_alerts="[]"
    if [[ ${#all_alerts[@]} -gt 0 ]]; then
        combined_alerts=$(echo "${all_alerts[@]}" | jq -s 'add')
    fi
    
    # Process alerts based on alert type
    case "$alert_type" in
        "critical")
            process_critical_alerts "$combined_alerts"
            ;;
        "warning")
            process_warning_alerts "$combined_alerts"
            ;;
        "all")
            process_all_alerts "$combined_alerts" "$correlation_window"
            ;;
        *)
            log "ERROR" "Unknown alert type: $alert_type"
            alerts_result="{\"status\":\"error\",\"message\":\"Unknown alert type: $alert_type\"}"
            return 1
            ;;
    esac
    
    echo "$alerts_result"
}

# Collect alerts from CloudWatch
collect_cloudwatch_alerts() {
    log "DEBUG" "Collecting CloudWatch alerts"
    
    if ! command_exists "aws"; then
        log "WARN" "AWS CLI not available for CloudWatch alerts"
        echo "[]"
        return
    fi
    
    local cw_alerts
    if ! cw_alerts=$(aws cloudwatch describe-alarms \
        --state-value ALARM \
        --output json 2>/dev/null | jq '.MetricAlarms'); then
        
        log "WARN" "Failed to collect CloudWatch alerts"
        echo "[]"
        return
    fi
    
    # Transform CloudWatch alerts to a standardized format
    echo "$cw_alerts" | jq '[.[] | {
        "source": "cloudwatch",
        "id": .AlarmArn,
        "name": .AlarmName,
        "description": .AlarmDescription,
        "severity": if .AlarmActions | length > 0 then "critical" else "warning" end,
        "timestamp": .StateUpdatedTimestamp,
        "status": .StateValue,
        "metric": .MetricName,
        "value": .StateReason,
        "resource": .Dimensions | map(.Name + ":" + .Value) | join(",")
    }]'
}

# Collect alerts from Prometheus Alertmanager
collect_prometheus_alerts() {
    log "DEBUG" "Collecting Prometheus alerts"
    
    local prom_alerts
    if ! prom_alerts=$(curl -s "$PROMETHEUS_ENDPOINT/api/v1/alerts" 2>/dev/null | jq '.data'); then
        log "WARN" "Failed to collect Prometheus alerts"
        echo "[]"
        return
    fi
    
    # Transform Prometheus alerts to a standardized format
    echo "$prom_alerts" | jq '[.alerts[] | {
        "source": "prometheus",
        "id": (.fingerprint // .alertname),
        "name": .labels.alertname,
        "description": .annotations.description,
        "severity": .labels.severity,
        "timestamp": .activeAt,
        "status": if .state == "firing" then "ALARM" else "OK" end,
        "metric": .labels.exported_job,
        "value": .annotations.value,
        "resource": (.labels.instance // "unknown")
    }]'
}

# Process critical alerts
process_critical_alerts() {
    local alerts="$1"
    
    log "INFO" "Processing critical alerts"
    
    # Filter critical alerts
    local critical_alerts
    critical_alerts=$(echo "$alerts" | jq '[.[] | select(.severity == "critical")]')
    
    # Count alerts
    local alert_count
    alert_count=$(echo "$critical_alerts" | jq 'length')
    
    log "INFO" "Found $alert_count critical alerts"
    
    if [[ "$alert_count" -gt 0 ]]; then
        # Generate notification payload
        local notification="{
            \"type\": \"critical_alert\",
            \"count\": $alert_count,
            \"alerts\": $critical_alerts,
            \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
        }"
        
        # Send notification (implement your notification logic here)
        # Example: send_notification "$notification"
        
        alerts_result="{\"status\":\"critical\",\"count\":$alert_count,\"alerts\":$critical_alerts}"
        monitoring_status=2
    else
        alerts_result="{\"status\":\"ok\",\"count\":0,\"alerts\":[]}"
    fi
}

# Process warning alerts
process_warning_alerts() {
    local alerts="$1"
    
    log "INFO" "Processing warning alerts"
    
    # Filter warning alerts
    local warning_alerts
    warning_alerts=$(echo "$alerts" | jq '[.[] | select(.severity == "warning")]')
    
    # Count alerts
    local alert_count
    alert_count=$(echo "$warning_alerts" | jq 'length')
    
    log "INFO" "Found $alert_count warning alerts"
    
    if [[ "$alert_count" -gt 0 ]]; then
        # Generate notification payload
        local notification="{
            \"type\": \"warning_alert\",
            \"count\": $alert_count,
            \"alerts\": $warning_alerts,
            \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
        }"
        
        # Send notification (implement your notification logic here)
        # Example: send_notification "$notification"
        
        alerts_result="{\"status\":\"warning\",\"count\":$alert_count,\"alerts\":$warning_alerts}"
        monitoring_status=1
    else
        alerts_result="{\"status\":\"ok\",\"count\":0,\"alerts\":[]}"
    fi
}

# Process all alerts with correlation
process_all_alerts() {
    local alerts="$1"
    local correlation_window="$2"
    
    log "INFO" "Processing all alerts with correlation window: ${correlation_window}s"
    
    # Count alerts by severity
    local critical_count
    critical_count=$(echo "$alerts" | jq '[.[] | select(.severity == "critical")] | length')
    
    local warning_count
    warning_count=$(echo "$alerts" | jq '[.[] | select(.severity == "warning")] | length')
    
    local info_count
    info_count=$(echo "$alerts" | jq '[.[] | select(.severity == "info")] | length')
    
    local total_count=$((critical_count + warning_count + info_count))
    
    log "INFO" "Found $total_count alerts ($critical_count critical, $warning_count warning, $info_count info)"
    
    # Correlate alerts
    local correlated_alerts
    correlated_alerts=$(correlate_alerts "$alerts" "$correlation_window")
    
    # Count correlated alerts
    local correlated_count
    correlated_count=$(echo "$correlated_alerts" | jq 'length')
    
    log "INFO" "After correlation: $correlated_count alert groups"
    
    # Determine overall status
    local status="ok"
    if [[ "$critical_count" -gt 0 ]]; then
        status="critical"
        monitoring_status=2
    elif [[ "$warning_count" -gt 0 ]]; then
        status="warning"
        monitoring_status=1
    fi
    
    alerts_result="{
        \"status\": \"$status\",
        \"total_count\": $total_count,
        \"critical_count\": $critical_count,
        \"warning_count\": $warning_count,
        \"info_count\": $info_count,
        \"correlated_count\": $correlated_count,
        \"correlated_alerts\": $correlated_alerts,
        \"raw_alerts\": $alerts
    }"
}

# Correlate related alerts
correlate_alerts() {
    local alerts="$1"
    local window="$2"
    
    log "DEBUG" "Correlating alerts within a ${window}s window"
    
    # Group alerts by resource
    local resource_groups
    resource_groups=$(echo "$alerts" | jq 'group_by(.resource)')
    
    # For each resource group, further correlate by time window
    echo "$resource_groups" | jq --arg window "$window" '[
        .[] | 
        # Sort by timestamp
        sort_by(.timestamp) |
        # Group alerts that occur within the correlation window
        reduce .[] as $alert (
            [];
            if length == 0 then
                [{alerts: [$alert], root: $alert}]
            else
                $last_group = .[-1];
                $last_time = ($last_group.alerts[-1].timestamp | fromdateiso8601);
                $alert_time = ($alert.timestamp | fromdateiso8601);
                if ($alert_time - $last_time) <= ($window | tonumber) then
                    # Add to existing group
                    .[-1].alerts += [$alert]
                else
                    # Create a new group
                    . + [{alerts: [$alert], root: $alert}]
                end
            end
        )
    ] | flatten'
}

# ================================================================================
# Main Script Execution
# ================================================================================

# Default operation flags
run_health=false
run_metrics=false
run_logs=false
run_alerts=false
run_all=true

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --health-check)
            run_health=true
            run_all=false
            shift
            ;;
        --collect-metrics)
            run_metrics=true
            run_all=false
            shift
            ;;
        --ship-logs)
            run_logs=true
            run_all=false
            shift
            ;;
        --check-alerts)
            run_alerts=true
            run_all=false
            shift
            ;;
        --all)
            run_all=true
            shift
            ;;
        *)
            log "ERROR" "Unknown option: $1"
            echo "Usage: $0 [--health-check] [--collect-metrics] [--ship-logs] [--check-alerts] [--all]"
            exit 1
            ;;
    esac
done

# If --all is selected, enable all operations
if [[ "$run_all" == "true" ]]; then
    run_health=true
    run_metrics=true
    run_logs=true
    run_alerts=true
fi

# Check required dependencies
check_dependencies

# Run the selected operations
log "INFO" "Starting monitoring operations"

# Service health checks
if [[ "$run_health" == "true" ]]; then
    log "INFO" "Running service health checks"
    health_status=$(check_service_health "all")
    log "INFO" "Health check results: $(echo "$health_status" | jq -c)"
fi

# Metrics collection
if [[ "$run_metrics" == "true" ]]; then
    log "INFO" "Running metrics collection"
    metrics_summary=$(collect_metrics "all" "{}")
    log "INFO" "Metrics summary: $(echo "$metrics_summary" | jq -c)"
fi

# Log shipping
if [[ "$run_logs" == "true" ]]; then
    log "INFO" "Running log shipping"
    ship_logs "/var/log/user-management-dashboard/*.log" "{\"rotation\":{\"enabled\":true,\"max_size\":\"100M\",\"max_files\":10}}"
fi

# Alert checking
if [[ "$run_alerts" == "true" ]]; then
    log "INFO" "Running alert checks"
    alerts_result=$(check_alerts "all" "{}")
    log "INFO" "Alert check results: $(echo "$alerts_result" | jq -c)"
fi

# Final monitoring status
log "INFO" "Monitoring completed with status code: $monitoring_status"

# Export monitoring status as JSON
cat > /tmp/monitoring_status.json << EOF
{
    "exit_code": $monitoring_status,
    "health_status": $health_status,
    "metrics_summary": $metrics_summary,
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Exit with appropriate status code
exit $monitoring_status