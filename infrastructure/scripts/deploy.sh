#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

#################################################
# User Management Dashboard Deployment Script
# Version: 1.0.0
#
# This script automates the deployment of the User Management Dashboard application
# across development, staging, and production environments with:
# - Infrastructure provisioning using Terraform
# - Docker image building and pushing to ECR
# - Blue/green deployment strategy for production
# - Post-deployment verification and health checks
# - Automatic rollback in case of deployment failure
#################################################

# Global variables
APP_NAME="user-management-dashboard"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TERRAFORM_DIR="$REPO_ROOT/infrastructure/terraform"
DOCKER_DIR="$REPO_ROOT/infrastructure/docker"
SRC_DIR="$REPO_ROOT/src"
LOG_FILE="/tmp/${APP_NAME}-deploy-$(date +%Y%m%d%H%M%S).log"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Default environment variables, which can be overridden
AWS_REGION=${AWS_REGION:-"us-west-2"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}
VERSION_TAG=${VERSION_TAG:-$TIMESTAMP}

# Define color codes for enhanced output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging utility functions
log_info() {
    echo -e "${BLUE}[INFO] $(date +"%Y-%m-%d %H:%M:%S") - $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS] $(date +"%Y-%m-%d %H:%M:%S") - $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING] $(date +"%Y-%m-%d %H:%M:%S") - $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR] $(date +"%Y-%m-%d %H:%M:%S") - $1${NC}" | tee -a "$LOG_FILE"
}

# Usage information
print_usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] COMMAND

Deployment automation script for User Management Dashboard application.

Commands:
  deploy              Deploy the infrastructure and application
  rollback            Rollback to previous deployment
  help                Display this help message

Options:
  -e, --environment   Deployment environment (dev/staging/prod) [default: dev]
  -r, --region        AWS region [default: us-west-2]
  -v, --version       Version tag for the deployment [default: timestamp]
  -a, --account-id    AWS account ID [required]
  -n, --no-infra      Skip infrastructure deployment
  -h, --help          Display this help message

Examples:
  $(basename "$0") -e prod -a 123456789012 deploy
  $(basename "$0") -e prod -a 123456789012 -v v1.2.3 rollback
  $(basename "$0") -e dev -a 123456789012 -n deploy

EOF
}

# Parse command line arguments
parse_args() {
    COMMAND=""
    SKIP_INFRA=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -r|--region)
                AWS_REGION="$2"
                shift 2
                ;;
            -v|--version)
                VERSION_TAG="$2"
                shift 2
                ;;
            -a|--account-id)
                AWS_ACCOUNT_ID="$2"
                shift 2
                ;;
            -n|--no-infra)
                SKIP_INFRA=true
                shift
                ;;
            -h|--help)
                print_usage
                exit 0
                ;;
            deploy|rollback|help)
                COMMAND="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done

    # Validate required parameters
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        log_error "AWS account ID is required. Use -a or --account-id option."
        print_usage
        exit 1
    fi

    # Validate environment value
    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be one of: dev, staging, prod."
        print_usage
        exit 1
    fi

    # Update ECR repository with account ID
    ECR_REPOSITORY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}"
    
    # Validate command
    if [ -z "$COMMAND" ]; then
        log_error "No command specified. Use deploy, rollback, or help."
        print_usage
        exit 1
    fi
}

# Check if all required tools and configurations are available
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        return 1
    fi
    
    # Check AWS CLI version
    AWS_CLI_VERSION=$(aws --version 2>&1 | cut -d' ' -f1 | cut -d'/' -f2)
    if [[ "$(echo "$AWS_CLI_VERSION" | cut -d'.' -f1)" -lt 2 ]]; then
        log_warning "AWS CLI version $AWS_CLI_VERSION detected. Version 2.x is recommended."
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured correctly."
        return 1
    fi
    
    # Check if user has sufficient permissions
    if ! aws iam get-user &> /dev/null; then
        log_warning "Unable to verify IAM permissions. Proceeding, but deployment might fail."
    fi
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install it first."
        return 1
    fi
    
    # Check Terraform version
    TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version' 2>/dev/null || terraform version | head -n 1 | cut -d "v" -f2)
    if [[ "$(echo "$TERRAFORM_VERSION" | cut -d'.' -f1)" -lt 1 ]]; then
        log_error "Terraform version $TERRAFORM_VERSION detected. Version 1.0.0+ is required."
        return 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        return 1
    fi
    
    # Check Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start it first."
        return 1
    fi
    
    # Check jq for JSON parsing
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first."
        return 1
    fi
    
    # Check if terraform directory exists
    if [ ! -d "$TERRAFORM_DIR" ]; then
        log_error "Terraform directory not found at $TERRAFORM_DIR"
        return 1
    fi
    
    # Check if environment-specific terraform directory exists
    if [ ! -d "$TERRAFORM_DIR/environments/$ENVIRONMENT" ]; then
        log_error "Environment-specific Terraform directory not found at $TERRAFORM_DIR/environments/$ENVIRONMENT"
        return 1
    fi
    
    # Check required environment variables
    log_info "Checking required environment variables..."
    log_info "AWS_REGION: $AWS_REGION"
    log_info "ENVIRONMENT: $ENVIRONMENT"
    log_info "AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
    log_info "VERSION_TAG: $VERSION_TAG"
    log_info "ECR_REPOSITORY: $ECR_REPOSITORY"
    
    log_success "All prerequisites checked successfully."
    return 0
}

# Deploy or update infrastructure using Terraform
deploy_infrastructure() {
    if [ "$SKIP_INFRA" = true ]; then
        log_info "Skipping infrastructure deployment as requested."
        return 0
    fi
    
    log_info "Deploying infrastructure for environment: $ENVIRONMENT"
    
    # Navigate to environment-specific Terraform directory
    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"
    
    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init -upgrade || {
        log_error "Failed to initialize Terraform."
        return 1
    }
    
    # Create Terraform plan
    log_info "Creating Terraform plan..."
    terraform plan -out=tfplan || {
        log_error "Failed to create Terraform plan."
        return 1
    }
    
    # Apply Terraform plan
    log_info "Applying Terraform plan..."
    terraform apply -auto-approve tfplan || {
        log_error "Failed to apply Terraform plan."
        return 1
    }
    
    # Capture important outputs for later use
    VPC_ID=$(terraform output -raw vpc_id 2>/dev/null || echo "")
    ALB_DNS_NAME=$(terraform output -raw alb_dns_name 2>/dev/null || echo "")
    
    if [ -z "$VPC_ID" ] || [ -z "$ALB_DNS_NAME" ]; then
        log_warning "Some Terraform outputs could not be captured."
    else
        log_info "VPC ID: $VPC_ID"
        log_info "ALB DNS Name: $ALB_DNS_NAME"
        
        # Save for other functions to use
        echo "$ALB_DNS_NAME" > "/tmp/${APP_NAME}-alb-dns-${ENVIRONMENT}.txt"
    fi
    
    log_success "Infrastructure deployment completed successfully."
    return 0
}

# Build and push Docker images to ECR
build_and_push_images() {
    local version_tag=$1
    log_info "Building and pushing Docker images with tag: $version_tag"
    
    # Authenticate with ECR
    log_info "Authenticating with Amazon ECR..."
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com" || {
        log_error "Failed to authenticate with Amazon ECR."
        return 1
    }
    
    # Create repositories if they don't exist
    log_info "Ensuring ECR repositories exist..."
    ensure_ecr_repository "${APP_NAME}-frontend"
    ensure_ecr_repository "${APP_NAME}-backend"
    
    # Build and push frontend image
    log_info "Building and pushing frontend image..."
    cd "$SRC_DIR/web"
    
    # Check if frontend directory exists
    if [ ! -d "$SRC_DIR/web" ]; then
        log_error "Frontend source directory not found at $SRC_DIR/web"
        return 1
    fi
    
    log_info "Building frontend Docker image..."
    docker build -t "${ECR_REPOSITORY}-frontend:$version_tag" -t "${ECR_REPOSITORY}-frontend:latest" . || {
        log_error "Failed to build frontend image."
        return 1
    }
    
    log_info "Pushing frontend Docker image with tag: $version_tag"
    docker push "${ECR_REPOSITORY}-frontend:$version_tag" || {
        log_error "Failed to push frontend image with tag $version_tag."
        return 1
    }
    
    log_info "Pushing frontend Docker image with tag: latest"
    docker push "${ECR_REPOSITORY}-frontend:latest" || {
        log_error "Failed to push frontend image with tag latest."
        return 1
    }
    
    # Build and push backend image
    log_info "Building and pushing backend image..."
    cd "$SRC_DIR/backend"
    
    # Check if backend directory exists
    if [ ! -d "$SRC_DIR/backend" ]; then
        log_error "Backend source directory not found at $SRC_DIR/backend"
        return 1
    fi
    
    log_info "Building backend Docker image..."
    docker build -t "${ECR_REPOSITORY}-backend:$version_tag" -t "${ECR_REPOSITORY}-backend:latest" . || {
        log_error "Failed to build backend image."
        return 1
    }
    
    log_info "Pushing backend Docker image with tag: $version_tag"
    docker push "${ECR_REPOSITORY}-backend:$version_tag" || {
        log_error "Failed to push backend image with tag $version_tag."
        return 1
    }
    
    log_info "Pushing backend Docker image with tag: latest"
    docker push "${ECR_REPOSITORY}-backend:latest" || {
        log_error "Failed to push backend image with tag latest."
        return 1
    }
    
    log_success "All images built and pushed successfully."
    return 0
}

# Ensure ECR repository exists
ensure_ecr_repository() {
    local repo_name=$1
    
    # Check if repository exists
    if ! aws ecr describe-repositories --repository-names "$repo_name" --region "$AWS_REGION" &> /dev/null; then
        log_info "Creating ECR repository: $repo_name"
        aws ecr create-repository --repository-name "$repo_name" --region "$AWS_REGION" || {
            log_error "Failed to create ECR repository: $repo_name"
            return 1
        }
        
        # Apply lifecycle policy to limit number of images
        log_info "Applying lifecycle policy to repository: $repo_name"
        aws ecr put-lifecycle-policy \
            --repository-name "$repo_name" \
            --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"Keep last 10 images","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":10},"action":{"type":"expire"}}]}' \
            --region "$AWS_REGION" || {
            log_warning "Failed to apply lifecycle policy to repository: $repo_name"
        }
    else
        log_info "ECR repository $repo_name already exists."
    fi
    
    return 0
}

# Deploy application to ECS using blue/green strategy
deploy_application() {
    local version_tag=$1
    log_info "Deploying application with tag: $version_tag for environment: $ENVIRONMENT"
    
    # Get service and cluster names
    local service_name="${APP_NAME}-service-${ENVIRONMENT}"
    local cluster_name="${APP_NAME}-cluster-${ENVIRONMENT}"
    
    # Check if cluster exists
    if ! aws ecs describe-clusters --clusters "$cluster_name" --region "$AWS_REGION" | jq -e '.clusters[] | select(.clusterName == "'"$cluster_name"'")' &> /dev/null; then
        log_error "ECS cluster $cluster_name does not exist."
        return 1
    fi
    
    # Check if service exists
    if ! aws ecs describe-services --cluster "$cluster_name" --services "$service_name" --region "$AWS_REGION" | jq -e '.services[] | select(.serviceName == "'"$service_name"'")' &> /dev/null; then
        log_error "ECS service $service_name does not exist in cluster $cluster_name."
        return 1
    fi
    
    # Get the current task definition
    log_info "Getting current task definition..."
    local current_task_def_arn=$(aws ecs describe-services --cluster "$cluster_name" --services "$service_name" --region "$AWS_REGION" | jq -r '.services[0].taskDefinition')
    
    if [ -z "$current_task_def_arn" ] || [ "$current_task_def_arn" == "null" ]; then
        log_error "Failed to get current task definition ARN."
        return 1
    fi
    
    local current_task_def=$(aws ecs describe-task-definition --task-definition "$current_task_def_arn" --region "$AWS_REGION")
    
    if [ -z "$current_task_def" ]; then
        log_error "Failed to get current task definition details."
        return 1
    fi
    
    # Create new task definition JSON with updated image
    log_info "Creating new task definition with updated images..."
    local temp_task_def_file="/tmp/${APP_NAME}-task-def-${ENVIRONMENT}-${VERSION_TAG}.json"
    
    # Extract containerDefinitions and update image tags
    echo "$current_task_def" | jq --arg IMAGE_TAG "$version_tag" --arg ECR_REPO_FRONTEND "${ECR_REPOSITORY}-frontend" --arg ECR_REPO_BACKEND "${ECR_REPOSITORY}-backend" '.taskDefinition | .containerDefinitions = (.containerDefinitions | map(if .name == "frontend" then .image = $ECR_REPO_FRONTEND + ":" + $IMAGE_TAG else . end)) | .containerDefinitions = (.containerDefinitions | map(if .name == "backend" then .image = $ECR_REPO_BACKEND + ":" + $IMAGE_TAG else . end)) | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' > "$temp_task_def_file"
    
    if [ ! -s "$temp_task_def_file" ]; then
        log_error "Failed to create new task definition JSON or file is empty."
        return 1
    fi
    
    # Register the new task definition
    log_info "Registering new task definition..."
    local new_task_def_arn=$(aws ecs register-task-definition --cli-input-json "file://$temp_task_def_file" --region "$AWS_REGION" | jq -r '.taskDefinition.taskDefinitionArn')
    
    if [ -z "$new_task_def_arn" ] || [ "$new_task_def_arn" == "null" ]; then
        log_error "Failed to register new task definition."
        return 1
    fi
    
    log_info "New task definition registered: $new_task_def_arn"
    
    # Create deployment based on environment
    if [ "$ENVIRONMENT" == "prod" ]; then
        # Use CodeDeploy for blue/green deployment in production
        deploy_prod_blue_green "$cluster_name" "$service_name" "$new_task_def_arn"
    else
        # Use standard ECS deployment for non-production environments
        deploy_standard_ecs "$cluster_name" "$service_name" "$new_task_def_arn"
    fi
    
    local deploy_result=$?
    if [ $deploy_result -ne 0 ]; then
        return $deploy_result
    fi
    
    log_success "Application deployed successfully."
    return 0
}

# Deploy using standard ECS deployment
deploy_standard_ecs() {
    local cluster_name=$1
    local service_name=$2
    local task_def_arn=$3
    
    log_info "Updating ECS service with new task definition..."
    aws ecs update-service --cluster "$cluster_name" --service "$service_name" --task-definition "$task_def_arn" --force-new-deployment --region "$AWS_REGION" || {
        log_error "Failed to update ECS service with new task definition."
        return 1
    }
    
    # Wait for service to become stable
    log_info "Waiting for service to become stable..."
    local max_attempts=60
    local wait_seconds=30
    local attempts=0
    
    while [ $attempts -lt $max_attempts ]; do
        attempts=$((attempts + 1))
        
        local service_status=$(aws ecs describe-services --cluster "$cluster_name" --services "$service_name" --region "$AWS_REGION")
        local deployments_count=$(echo "$service_status" | jq '.services[0].deployments | length')
        local primary_deployment_status=$(echo "$service_status" | jq -r '.services[0].deployments[] | select(.status == "PRIMARY") | .rolloutState')
        
        log_info "Deployment status: $primary_deployment_status (attempt $attempts/$max_attempts)"
        
        if [ "$deployments_count" == "1" ] && [ "$primary_deployment_status" == "COMPLETED" ]; then
            log_success "Service deployment completed successfully!"
            break
        elif [ "$primary_deployment_status" == "FAILED" ]; then
            log_error "Service deployment failed."
            return 1
        fi
        
        if [ $attempts -eq $max_attempts ]; then
            log_error "Service deployment timed out after $max_attempts attempts."
            return 1
        fi
        
        log_info "Waiting for $wait_seconds seconds..."
        sleep $wait_seconds
    done
    
    return 0
}

# Deploy using blue/green deployment for production
deploy_prod_blue_green() {
    local cluster_name=$1
    local service_name=$2
    local task_def_arn=$3
    
    log_info "Creating blue/green deployment for production..."
    
    # Check if CodeDeploy application exists
    local codedeploy_app="${APP_NAME}-codedeploy"
    if ! aws deploy get-application --application-name "$codedeploy_app" --region "$AWS_REGION" &> /dev/null; then
        log_warning "CodeDeploy application $codedeploy_app does not exist."
        log_info "Creating CodeDeploy application..."
        aws deploy create-application --application-name "$codedeploy_app" --compute-platform ECS --region "$AWS_REGION" || {
            log_error "Failed to create CodeDeploy application."
            return 1
        }
    fi
    
    # Check if deployment group exists
    local deployment_group="${APP_NAME}-deployment-group"
    if ! aws deploy get-deployment-group --application-name "$codedeploy_app" --deployment-group-name "$deployment_group" --region "$AWS_REGION" &> /dev/null; then
        log_warning "CodeDeploy deployment group $deployment_group does not exist."
        log_info "Creating deployment group with blue/green deployment configuration..."
        
        # Get load balancer info
        local target_group_1=$(aws ecs describe-services --services "$service_name" --cluster "$cluster_name" --region "$AWS_REGION" | jq -r '.services[0].loadBalancers[0].targetGroupArn')
        
        # Create a second target group for blue/green deployment
        local vpc_id=$(aws elbv2 describe-target-groups --target-group-arns "$target_group_1" --region "$AWS_REGION" | jq -r '.TargetGroups[0].VpcId')
        local target_group_2_name="${APP_NAME}-tg-2-${ENVIRONMENT}"
        
        log_info "Creating second target group for blue/green deployment..."
        local target_group_2=$(aws elbv2 create-target-group --name "$target_group_2_name" --protocol HTTP --port 80 --vpc-id "$vpc_id" --target-type ip --health-check-path "/health" --health-check-interval-seconds 30 --health-check-timeout-seconds 5 --healthy-threshold-count 2 --unhealthy-threshold-count 2 --region "$AWS_REGION" | jq -r '.TargetGroups[0].TargetGroupArn')
        
        if [ -z "$target_group_2" ] || [ "$target_group_2" == "null" ]; then
            log_error "Failed to create second target group for blue/green deployment."
            return 1
        fi
        
        # Get ALB ARN
        local load_balancer_arn=$(aws elbv2 describe-target-groups --target-group-arns "$target_group_1" --region "$AWS_REGION" | jq -r '.TargetGroups[0].LoadBalancerArns[0]')
        
        # Create CodeDeploy deployment group
        aws deploy create-deployment-group \
            --application-name "$codedeploy_app" \
            --deployment-group-name "$deployment_group" \
            --deployment-config-name CodeDeployDefault.ECSAllAtOnce \
            --service-role-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsCodeDeployRole" \
            --ecs-services "serviceName=${service_name},clusterName=${cluster_name}" \
            --load-balancer-info "targetGroupPairInfoList=[{targetGroups=[{name=$(aws elbv2 describe-target-groups --target-group-arns "$target_group_1" --region "$AWS_REGION" | jq -r '.TargetGroups[0].TargetGroupName')},{name=$target_group_2_name}],prodTrafficRoute={listenerArns=[$(aws elbv2 describe-listeners --load-balancer-arn "$load_balancer_arn" --region "$AWS_REGION" | jq -r '.Listeners[0].ListenerArn')]},testTrafficRoute={listenerArns=[$(aws elbv2 describe-listeners --load-balancer-arn "$load_balancer_arn" --region "$AWS_REGION" | jq -r '.Listeners[1].ListenerArn')]}}]" \
            --blue-green-deployment-configuration "terminateBlueInstancesOnDeploymentSuccess={action=TERMINATE,terminationWaitTimeInMinutes=5},deploymentReadyOption={actionOnTimeout=CONTINUE_DEPLOYMENT,waitTimeInMinutes=0},greenFleetProvisioningOption={action=DISCOVER_EXISTING}" \
            --auto-rollback-configuration "enabled=true,events=[DEPLOYMENT_FAILURE]" \
            --region "$AWS_REGION" || {
            log_error "Failed to create CodeDeploy deployment group."
            return 1
        }
    fi
    
    # Create AppSpec content for CodeDeploy
    local appspec_content='{
        "version": 1,
        "Resources": [
            {
                "TargetService": {
                    "Type": "AWS::ECS::Service",
                    "Properties": {
                        "TaskDefinition": "'"$task_def_arn"'",
                        "LoadBalancerInfo": {
                            "ContainerName": "frontend",
                            "ContainerPort": 80
                        }
                    }
                }
            }
        ],
        "Hooks": [
            {
                "BeforeAllowTraffic": "'"${APP_NAME}-before-allow-traffic-hook-${ENVIRONMENT}"'"
            },
            {
                "AfterAllowTraffic": "'"${APP_NAME}-after-allow-traffic-hook-${ENVIRONMENT}"'"
            }
        ]
    }'
    
    # Write AppSpec to file
    local appspec_file="/tmp/${APP_NAME}-appspec-${ENVIRONMENT}-${VERSION_TAG}.json"
    echo "$appspec_content" > "$appspec_file"
    
    # Create CodeDeploy deployment
    log_info "Creating CodeDeploy deployment..."
    local deployment_id=$(aws deploy create-deployment \
        --application-name "$codedeploy_app" \
        --deployment-group-name "$deployment_group" \
        --revision "revisionType=AppSpecContent,appSpecContent={content=$(cat "$appspec_file")}" \
        --description "Deployment of version $VERSION_TAG to $ENVIRONMENT" \
        --region "$AWS_REGION" | jq -r '.deploymentId')
    
    if [ -z "$deployment_id" ] || [ "$deployment_id" == "null" ]; then
        log_error "Failed to create CodeDeploy deployment."
        return 1
    fi
    
    log_info "CodeDeploy deployment created: $deployment_id"
    
    # Wait for deployment to complete
    log_info "Waiting for blue/green deployment to complete..."
    local max_attempts=60
    local wait_seconds=30
    local attempts=0
    local deployment_status=""
    
    while [ $attempts -lt $max_attempts ]; do
        attempts=$((attempts + 1))
        
        deployment_status=$(aws deploy get-deployment --deployment-id "$deployment_id" --region "$AWS_REGION" | jq -r '.deploymentInfo.status')
        
        log_info "Deployment status: $deployment_status (attempt $attempts/$max_attempts)"
        
        if [ "$deployment_status" == "Succeeded" ]; then
            log_success "Deployment succeeded!"
            break
        elif [[ "$deployment_status" == "Failed" || "$deployment_status" == "Stopped" ]]; then
            log_error "Deployment failed with status: $deployment_status"
            return 1
        fi
        
        if [ $attempts -eq $max_attempts ]; then
            log_error "Deployment timed out after $max_attempts attempts."
            return 1
        fi
        
        log_info "Waiting for $wait_seconds seconds..."
        sleep $wait_seconds
    done
    
    return 0
}

# Run post-deployment checks
run_post_deployment_checks() {
    log_info "Running post-deployment checks..."
    
    # Get ALB DNS name if not already set
    if [ -z "$ALB_DNS_NAME" ]; then
        log_info "Retrieving ALB DNS name..."
        if [ -f "/tmp/${APP_NAME}-alb-dns-${ENVIRONMENT}.txt" ]; then
            ALB_DNS_NAME=$(cat "/tmp/${APP_NAME}-alb-dns-${ENVIRONMENT}.txt")
            log_info "Retrieved ALB DNS name from file: $ALB_DNS_NAME"
        else
            local cluster_name="${APP_NAME}-cluster-${ENVIRONMENT}"
            local service_name="${APP_NAME}-service-${ENVIRONMENT}"
            
            # Get the load balancer DNS name from the ECS service
            local service_info=$(aws ecs describe-services --cluster "$cluster_name" --services "$service_name" --region "$AWS_REGION")
            local target_group_arn=$(echo "$service_info" | jq -r '.services[0].loadBalancers[0].targetGroupArn')
            
            if [ -z "$target_group_arn" ] || [ "$target_group_arn" == "null" ]; then
                log_warning "Could not find target group ARN for service $service_name."
            else
                local target_group_info=$(aws elbv2 describe-target-groups --target-group-arns "$target_group_arn" --region "$AWS_REGION")
                local load_balancer_arn=$(echo "$target_group_info" | jq -r '.TargetGroups[0].LoadBalancerArns[0]')
                
                if [ -z "$load_balancer_arn" ] || [ "$load_balancer_arn" == "null" ]; then
                    log_warning "Could not find load balancer ARN for target group $target_group_arn."
                else
                    ALB_DNS_NAME=$(aws elbv2 describe-load-balancers --load-balancer-arns "$load_balancer_arn" --region "$AWS_REGION" | jq -r '.LoadBalancers[0].DNSName')
                fi
            fi
        fi
    fi
    
    if [ -z "$ALB_DNS_NAME" ] || [ "$ALB_DNS_NAME" == "null" ]; then
        log_warning "Could not determine ALB DNS name for health checks."
        log_warning "Skipping health checks. Please verify the deployment manually."
        return 0
    fi
    
    log_info "Using ALB DNS name for health checks: $ALB_DNS_NAME"
    
    local protocol="https"
    # Use http for dev and staging for simplicity in checking
    if [ "$ENVIRONMENT" != "prod" ]; then
        protocol="http"
    fi
    
    local health_endpoint="${protocol}://${ALB_DNS_NAME}/health"
    local api_endpoint="${protocol}://${ALB_DNS_NAME}/api/health"
    local max_attempts=30
    local wait_seconds=10
    local attempts=0
    
    # Check application health endpoint
    log_info "Checking application health endpoint: $health_endpoint"
    attempts=0
    while [ $attempts -lt $max_attempts ]; do
        attempts=$((attempts + 1))
        
        if curl -s -f -o /dev/null "$health_endpoint"; then
            log_success "Health endpoint check passed."
            break
        else
            log_warning "Health endpoint check failed (attempt $attempts/$max_attempts). Retrying in $wait_seconds seconds..."
            sleep $wait_seconds
        fi
        
        if [ $attempts -eq $max_attempts ]; then
            log_error "Health endpoint check failed after $max_attempts attempts."
            return 1
        fi
    done
    
    # Check API health endpoint
    log_info "Checking API health endpoint: $api_endpoint"
    attempts=0
    while [ $attempts -lt $max_attempts ]; do
        attempts=$((attempts + 1))
        
        if curl -s -f -o /dev/null "$api_endpoint"; then
            log_success "API health endpoint check passed."
            break
        else
            log_warning "API health endpoint check failed (attempt $attempts/$max_attempts). Retrying in $wait_seconds seconds..."
            sleep $wait_seconds
        fi
        
        if [ $attempts -eq $max_attempts ]; then
            log_error "API health endpoint check failed after $max_attempts attempts."
            return 1
        fi
    done
    
    # Check database connectivity (through API endpoint)
    log_info "Checking database connectivity..."
    local db_check_endpoint="${protocol}://${ALB_DNS_NAME}/api/health/database"
    attempts=0
    while [ $attempts -lt $max_attempts ]; do
        attempts=$((attempts + 1))
        
        if curl -s -f -o /dev/null "$db_check_endpoint"; then
            log_success "Database connectivity check passed."
            break
        else
            log_warning "Database connectivity check failed (attempt $attempts/$max_attempts). Retrying in $wait_seconds seconds..."
            sleep $wait_seconds
        fi
        
        if [ $attempts -eq $max_attempts ]; then
            log_warning "Database connectivity check failed after $max_attempts attempts."
            # Continue deployment even if database check fails
        fi
    done
    
    # Check Redis cache connectivity (through API endpoint)
    log_info "Checking Redis cache connectivity..."
    local redis_check_endpoint="${protocol}://${ALB_DNS_NAME}/api/health/redis"
    attempts=0
    while [ $attempts -lt $max_attempts ]; do
        attempts=$((attempts + 1))
        
        if curl -s -f -o /dev/null "$redis_check_endpoint"; then
            log_success "Redis cache connectivity check passed."
            break
        else
            log_warning "Redis cache connectivity check failed (attempt $attempts/$max_attempts). Retrying in $wait_seconds seconds..."
            sleep $wait_seconds
        fi
        
        if [ $attempts -eq $max_attempts ]; then
            log_warning "Redis cache connectivity check failed after $max_attempts attempts."
            # Continue deployment even if Redis check fails
        fi
    done
    
    # Verify SSL certificate validity if in production
    if [ "$ENVIRONMENT" == "prod" ]; then
        log_info "Checking SSL certificate validity..."
        if command -v openssl &> /dev/null; then
            local cert_expiry=$(echo | openssl s_client -servername "${ALB_DNS_NAME}" -connect "${ALB_DNS_NAME}:443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
            local current_date=$(date +%s)
            local expiry_date=$(date -d "$cert_expiry" +%s)
            local days_remaining=$(( (expiry_date - current_date) / 86400 ))
            
            if [ $days_remaining -lt 30 ]; then
                log_warning "SSL certificate for ${ALB_DNS_NAME} will expire in $days_remaining days."
            else
                log_success "SSL certificate valid for $days_remaining days."
            fi
        else
            log_warning "OpenSSL not found. Skipping SSL certificate check."
        fi
    fi
    
    # Check for errors in CloudWatch logs
    log_info "Checking CloudWatch logs for errors..."
    local log_group="/aws/ecs/${APP_NAME}-${ENVIRONMENT}"
    local current_time=$(date +%s)
    local start_time=$((current_time - 300)) # Check last 5 minutes
    
    if aws logs describe-log-groups --log-group-name-prefix "$log_group" --region "$AWS_REGION" &>/dev/null; then
        local error_count=$(aws logs filter-log-events --log-group-name "$log_group" --filter-pattern "ERROR" --start-time $((start_time * 1000)) --region "$AWS_REGION" | jq '.events | length')
        
        if [ "$error_count" -gt 0 ]; then
            log_warning "Found $error_count ERROR entries in CloudWatch logs in the last 5 minutes."
        else
            log_success "No errors found in CloudWatch logs."
        fi
    else
        log_warning "Log group $log_group not found. Skipping CloudWatch log check."
    fi
    
    log_success "All post-deployment checks completed."
    return 0
}

# Rollback to a previous deployment if current fails
rollback_deployment() {
    local previous_version=$1
    log_info "Rolling back deployment to version: $previous_version"
    
    # Get service and cluster names
    local service_name="${APP_NAME}-service-${ENVIRONMENT}"
    local cluster_name="${APP_NAME}-cluster-${ENVIRONMENT}"
    
    # Check if cluster and service exist
    if ! aws ecs describe-clusters --clusters "$cluster_name" --region "$AWS_REGION" | jq -e '.clusters[] | select(.clusterName == "'"$cluster_name"'")' &> /dev/null; then
        log_error "ECS cluster $cluster_name does not exist."
        return 1
    fi
    
    if ! aws ecs describe-services --cluster "$cluster_name" --services "$service_name" --region "$AWS_REGION" | jq -e '.services[] | select(.serviceName == "'"$service_name"'")' &> /dev/null; then
        log_error "ECS service $service_name does not exist in cluster $cluster_name."
        return 1
    fi
    
    # Special handling for production environment
    if [ "$ENVIRONMENT" == "prod" ]; then
        # For production, we check if there's an ongoing CodeDeploy deployment
        local codedeploy_app="${APP_NAME}-codedeploy"
        local deployment_group="${APP_NAME}-deployment-group"
        
        if aws deploy get-application --application-name "$codedeploy_app" --region "$AWS_REGION" &> /dev/null && \
           aws deploy get-deployment-group --application-name "$codedeploy_app" --deployment-group-name "$deployment_group" --region "$AWS_REGION" &> /dev/null; then
            
            # Check for in-progress deployments
            local deployments=$(aws deploy list-deployments --application-name "$codedeploy_app" --deployment-group-name "$deployment_group" --include-only-statuses InProgress --region "$AWS_REGION")
            local in_progress_count=$(echo "$deployments" | jq -r '.deployments | length')
            
            if [ "$in_progress_count" -gt 0 ]; then
                local deployment_id=$(echo "$deployments" | jq -r '.deployments[0]')
                log_warning "Found in-progress CodeDeploy deployment: $deployment_id"
                log_info "Stopping in-progress deployment..."
                
                aws deploy stop-deployment --deployment-id "$deployment_id" --region "$AWS_REGION" || {
                    log_warning "Failed to stop in-progress deployment. It may have already completed or been stopped."
                }
            fi
        else
            log_warning "CodeDeploy application or deployment group not found. Proceeding with ECS rollback."
        fi
    fi
    
    # Find previous task definition to roll back to
    local previous_task_def_arn=""
    
    if [ -n "$previous_version" ]; then
        # Find task definition with specific tag
        log_info "Looking for task definition with tag: $previous_version"
        
        # List all active task definitions in the family
        local task_defs=$(aws ecs list-task-definitions --family-prefix "${APP_NAME}-${ENVIRONMENT}" --status ACTIVE --sort DESC --region "$AWS_REGION" | jq -r '.taskDefinitionArns[]')
        
        # Loop through task definitions to find one with the matching tag
        for task_def in $task_defs; do
            local image=$(aws ecs describe-task-definition --task-definition "$task_def" --region "$AWS_REGION" | jq -r '.taskDefinition.containerDefinitions[0].image')
            if [[ "$image" == *":$previous_version" ]]; then
                previous_task_def_arn="$task_def"
                log_info "Found matching task definition: $previous_task_def_arn"
                break
            fi
        done
    else
        # If no specific version, get the previous task definition (current - 1)
        log_info "No specific version provided, using previous active task definition..."
        local current_task_def_arn=$(aws ecs describe-services --cluster "$cluster_name" --services "$service_name" --region "$AWS_REGION" | jq -r '.services[0].taskDefinition')
        local current_revision=$(echo "$current_task_def_arn" | awk -F ':' '{print $NF}')
        local family=$(echo "$current_task_def_arn" | awk -F '/' '{print $2}' | awk -F ':' '{print $1}')
        local previous_revision=$((current_revision - 1))
        
        if [ $previous_revision -le 0 ]; then
            log_error "No previous revision available for rollback."
            return 1
        fi
        
        previous_task_def_arn="arn:aws:ecs:${AWS_REGION}:${AWS_ACCOUNT_ID}:task-definition/${family}:${previous_revision}"
        log_info "Using previous task definition revision: $previous_task_def_arn"
    fi
    
    if [ -z "$previous_task_def_arn" ] || [ "$previous_task_def_arn" == "null" ]; then
        log_error "Could not find a suitable previous task definition for rollback."
        return 1
    fi
    
    # Verify the task definition exists
    if ! aws ecs describe-task-definition --task-definition "$previous_task_def_arn" --region "$AWS_REGION" &> /dev/null; then
        log_error "Task definition $previous_task_def_arn does not exist or cannot be accessed."
        return 1
    fi
    
    # Perform rollback based on environment
    if [ "$ENVIRONMENT" == "prod" ]; then
        rollback_prod_blue_green "$cluster_name" "$service_name" "$previous_task_def_arn"
    else
        rollback_standard_ecs "$cluster_name" "$service_name" "$previous_task_def_arn"
    fi
    
    local rollback_result=$?
    if [ $rollback_result -ne 0 ]; then
        return $rollback_result
    fi
    
    log_success "Rollback completed successfully."
    return 0
}

# Rollback using standard ECS deployment
rollback_standard_ecs() {
    local cluster_name=$1
    local service_name=$2
    local task_def_arn=$3
    
    log_info "Updating ECS service with previous task definition for rollback..."
    aws ecs update-service --cluster "$cluster_name" --service "$service_name" --task-definition "$task_def_arn" --force-new-deployment --region "$AWS_REGION" || {
        log_error "Failed to update ECS service with previous task definition."
        return 1
    }
    
    # Wait for service to become stable
    log_info "Waiting for service to become stable after rollback..."
    aws ecs wait services-stable --cluster "$cluster_name" --services "$service_name" --region "$AWS_REGION" || {
        log_error "Service failed to stabilize after rollback."
        return 1
    }
    
    log_success "Service updated successfully with previous task definition."
    return 0
}

# Rollback using blue/green deployment for production
rollback_prod_blue_green() {
    local cluster_name=$1
    local service_name=$2
    local task_def_arn=$3
    
    local codedeploy_app="${APP_NAME}-codedeploy"
    local deployment_group="${APP_NAME}-deployment-group"
    
    if aws deploy get-application --application-name "$codedeploy_app" --region "$AWS_REGION" &> /dev/null && \
       aws deploy get-deployment-group --application-name "$codedeploy_app" --deployment-group-name "$deployment_group" --region "$AWS_REGION" &> /dev/null; then
        
        # Create AppSpec content for CodeDeploy
        local appspec_content='{
            "version": 1,
            "Resources": [
                {
                    "TargetService": {
                        "Type": "AWS::ECS::Service",
                        "Properties": {
                            "TaskDefinition": "'"$task_def_arn"'",
                            "LoadBalancerInfo": {
                                "ContainerName": "frontend",
                                "ContainerPort": 80
                            }
                        }
                    }
                }
            ]
        }'
        
        # Write AppSpec to file
        local appspec_file="/tmp/${APP_NAME}-rollback-appspec-${ENVIRONMENT}.json"
        echo "$appspec_content" > "$appspec_file"
        
        # Create CodeDeploy deployment for rollback
        log_info "Creating CodeDeploy deployment for rollback..."
        local deployment_id=$(aws deploy create-deployment \
            --application-name "$codedeploy_app" \
            --deployment-group-name "$deployment_group" \
            --revision "revisionType=AppSpecContent,appSpecContent={content=$(cat "$appspec_file")}" \
            --description "Rollback deployment to previous version" \
            --region "$AWS_REGION" | jq -r '.deploymentId')
        
        if [ -z "$deployment_id" ] || [ "$deployment_id" == "null" ]; then
            log_error "Failed to create CodeDeploy deployment for rollback."
            return 1
        fi
        
        log_info "CodeDeploy rollback deployment created: $deployment_id"
        
        # Wait for deployment to complete
        log_info "Waiting for blue/green rollback deployment to complete..."
        local max_attempts=60
        local wait_seconds=30
        local attempts=0
        local deployment_status=""
        
        while [ $attempts -lt $max_attempts ]; do
            attempts=$((attempts + 1))
            
            deployment_status=$(aws deploy get-deployment --deployment-id "$deployment_id" --region "$AWS_REGION" | jq -r '.deploymentInfo.status')
            
            log_info "Rollback deployment status: $deployment_status (attempt $attempts/$max_attempts)"
            
            if [ "$deployment_status" == "Succeeded" ]; then
                log_success "Rollback deployment succeeded!"
                break
            elif [[ "$deployment_status" == "Failed" || "$deployment_status" == "Stopped" ]]; then
                log_error "Rollback deployment failed with status: $deployment_status"
                return 1
            fi
            
            if [ $attempts -eq $max_attempts ]; then
                log_error "Rollback deployment timed out after $max_attempts attempts."
                return 1
            fi
            
            log_info "Waiting for $wait_seconds seconds..."
            sleep $wait_seconds
        done
    else
        # Fall back to standard ECS deployment for rollback
        log_warning "CodeDeploy resources not found. Proceeding with standard ECS rollback."
        rollback_standard_ecs "$cluster_name" "$service_name" "$task_def_arn"
    fi
    
    return 0
}

# Send notification
send_notification() {
    local subject="$1"
    local message="$2"
    local severity="$3"
    
    log_info "Sending notification: $subject"
    
    # Check if SNS topic ARN is available
    if [ -n "$SNS_TOPIC_ARN" ]; then
        aws sns publish \
            --topic-arn "$SNS_TOPIC_ARN" \
            --subject "$subject" \
            --message "$message" \
            --region "$AWS_REGION" || {
            log_warning "Failed to send SNS notification."
        }
    else
        log_warning "SNS_TOPIC_ARN not set. Skipping notification."
    fi
    
    # For high severity, additional notifications could be sent (e.g., to PagerDuty)
    if [ "$severity" == "high" ] && [ -n "$PAGERDUTY_INTEGRATION_KEY" ]; then
        # Example PagerDuty integration (would require curl and jq)
        curl -X POST \
            -H "Content-Type: application/json" \
            -d '{
                "routing_key": "'"$PAGERDUTY_INTEGRATION_KEY"'",
                "event_action": "trigger",
                "payload": {
                    "summary": "'"$subject"'",
                    "source": "'"${APP_NAME}-deployment"'",
                    "severity": "critical",
                    "custom_details": {
                        "message": "'"$message"'",
                        "environment": "'"$ENVIRONMENT"'"
                    }
                }
            }' \
            "https://events.pagerduty.com/v2/enqueue" || {
            log_warning "Failed to send PagerDuty alert."
        }
    fi
}

# Main deployment function
deploy() {
    log_info "Starting deployment process for $APP_NAME in $ENVIRONMENT environment"
    
    # Create log file
    touch "$LOG_FILE"
    log_info "Logs will be saved to: $LOG_FILE"
    
    # Check prerequisites
    check_prerequisites || {
        log_error "Prerequisites check failed. Aborting deployment."
        send_notification "${APP_NAME^} Deployment Failed" "Prerequisites check failed. See logs for details." "high"
        return 1
    }
    
    # Deploy infrastructure
    if [ "$SKIP_INFRA" = false ]; then
        deploy_infrastructure || {
            log_error "Infrastructure deployment failed. Aborting deployment."
            send_notification "${APP_NAME^} Deployment Failed" "Infrastructure deployment failed. See logs for details." "high"
            return 1
        }
    else
        log_info "Skipping infrastructure deployment as requested."
    fi
    
    # Build and push Docker images
    build_and_push_images "$VERSION_TAG" || {
        log_error "Docker image build and push failed. Aborting deployment."
        send_notification "${APP_NAME^} Deployment Failed" "Docker image build and push failed. See logs for details." "high"
        return 1
    }
    
    # Store current version for potential rollback
    local PREVIOUS_VERSION=""
    
    # Get the current version from ECS service
    if aws ecs describe-services --cluster "${APP_NAME}-cluster-${ENVIRONMENT}" --services "${APP_NAME}-service-${ENVIRONMENT}" --region "$AWS_REGION" &> /dev/null; then
        PREVIOUS_VERSION=$(aws ecs describe-services --cluster "${APP_NAME}-cluster-${ENVIRONMENT}" --services "${APP_NAME}-service-${ENVIRONMENT}" --region "$AWS_REGION" | jq -r '.services[0].taskDefinition' | xargs -I{} aws ecs describe-task-definition --task-definition {} --region "$AWS_REGION" | jq -r '.taskDefinition.containerDefinitions[0].image' | awk -F ':' '{print $NF}')
        
        if [ -n "$PREVIOUS_VERSION" ] && [ "$PREVIOUS_VERSION" != "null" ]; then
            log_info "Current version before deployment: $PREVIOUS_VERSION"
            echo "$PREVIOUS_VERSION" > "/tmp/${APP_NAME}-previous-version-${ENVIRONMENT}.txt"
        } else {
            log_warning "Could not determine current version for potential rollback."
        }
    } else {
        log_warning "ECS service not found. Skipping version backup for rollback."
    }
    
    # Deploy application
    deploy_application "$VERSION_TAG" || {
        log_error "Application deployment failed. Starting rollback..."
        send_notification "${APP_NAME^} Deployment Failed" "Application deployment failed. Starting rollback to previous version." "high"
        
        if [ -n "$PREVIOUS_VERSION" ]; then
            rollback_deployment "$PREVIOUS_VERSION" || {
                log_error "Rollback also failed! System may be in an inconsistent state."
                send_notification "${APP_NAME^} Critical Alert" "Both deployment and rollback failed! System may be in an inconsistent state." "high"
                return 2
            }
        } else {
            log_error "Cannot rollback: previous version unknown."
            return 1
        }
        
        return 1
    }
    
    # Run post-deployment checks
    run_post_deployment_checks || {
        log_error "Post-deployment checks failed. Starting rollback..."
        send_notification "${APP_NAME^} Deployment Failed" "Post-deployment checks failed. Starting rollback to previous version." "high"
        
        if [ -n "$PREVIOUS_VERSION" ]; then
            rollback_deployment "$PREVIOUS_VERSION" || {
                log_error "Rollback also failed! System may be in an inconsistent state."
                send_notification "${APP_NAME^} Critical Alert" "Both deployment and rollback failed! System may be in an inconsistent state." "high"
                return 2
            }
        } else {
            log_error "Cannot rollback: previous version unknown."
            return 1
        }
        
        return 1
    }
    
    # Send success notification
    send_notification "${APP_NAME^} Deployment Successful" "$APP_NAME has been successfully deployed to $ENVIRONMENT with version $VERSION_TAG." "low"
    
    log_success "Deployment completed successfully! Version: $VERSION_TAG"
    return 0
}

# Main rollback function
rollback() {
    log_info "Starting rollback process for $APP_NAME in $ENVIRONMENT environment"
    
    # Create log file
    touch "$LOG_FILE"
    log_info "Logs will be saved to: $LOG_FILE"
    
    # Check prerequisites
    check_prerequisites || {
        log_error "Prerequisites check failed. Aborting rollback."
        send_notification "${APP_NAME^} Rollback Failed" "Prerequisites check failed. See logs for details." "high"
        return 1
    }
    
    local previous_version=""
    
    if [ -n "$VERSION_TAG" ] && [ "$VERSION_TAG" != "$TIMESTAMP" ]; then
        # Use specified version
        previous_version="$VERSION_TAG"
    elif [ -f "/tmp/${APP_NAME}-previous-version-${ENVIRONMENT}.txt" ]; then
        # Use stored previous version
        previous_version=$(cat "/tmp/${APP_NAME}-previous-version-${ENVIRONMENT}.txt")
    fi
    
    if [ -z "$previous_version" ]; then
        log_warning "No specific version for rollback. Will attempt to use the previous task definition revision."
    } else {
        log_info "Rolling back to version: $previous_version"
    }
    
    # Perform rollback
    rollback_deployment "$previous_version" || {
        log_error "Rollback failed."
        send_notification "${APP_NAME^} Rollback Failed" "Rollback failed. System may be in an inconsistent state." "high"
        return 1
    }
    
    # Run post-deployment checks after rollback
    run_post_deployment_checks || {
        log_error "Post-rollback checks failed. System may be in an inconsistent state."
        send_notification "${APP_NAME^} Critical Alert" "Post-rollback checks failed. System may be in an inconsistent state." "high"
        return 1
    }
    
    # Send success notification
    if [ -n "$previous_version" ]; then
        send_notification "${APP_NAME^} Rollback Successful" "$APP_NAME has been successfully rolled back to version $previous_version in $ENVIRONMENT." "medium"
    } else {
        send_notification "${APP_NAME^} Rollback Successful" "$APP_NAME has been successfully rolled back to the previous version in $ENVIRONMENT." "medium"
    }
    
    log_success "Rollback completed successfully!"
    return 0
}

# Main execution
main() {
    # Parse command line arguments
    parse_args "$@"
    
    # Execute requested command
    case "$COMMAND" in
        deploy)
            deploy
            exit $?
            ;;
        rollback)
            rollback
            exit $?
            ;;
        help|"")
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            print_usage
            exit 1
            ;;
    esac
}

# Execute main function if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi