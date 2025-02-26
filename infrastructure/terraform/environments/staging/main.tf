# Staging environment Terraform configuration for User Management Dashboard
# This file defines infrastructure deployment for the staging environment with
# appropriate scaling and redundancy settings that mirrors production configuration
# with optimized resource allocation for staging workloads.

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # S3 backend for staging environment state management
  backend "s3" {
    bucket         = "user-mgmt-dashboard-tfstate-staging"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks-staging"
  }
}

# Configure AWS provider for the staging environment
provider "aws" {
  region = local.aws_region
  
  default_tags {
    tags = {
      Environment       = local.environment
      Project           = local.app_name
      ManagedBy         = "terraform"
      Owner             = "platform-team"
      CostCenter        = "platform-infrastructure"
      DeploymentStage   = "staging"
      SecurityCompliance = "required"
    }
  }
}

# Define local values for the staging environment
locals {
  environment = "staging"
  aws_region  = "us-east-1"
  app_name    = "user-mgmt-dashboard"
}

# Root module configuration for infrastructure deployment
module "root" {
  source = "../../"
  
  # Environment configuration
  environment             = local.environment
  aws_region              = local.aws_region
  app_name                = local.app_name
  
  # Networking configuration - using dedicated CIDR range for staging
  vpc_cidr                = "10.1.0.0/16"
  availability_zones      = ["us-east-1a", "us-east-1b", "us-east-1c"]
  
  # ECS configuration - 1vCPU/2GB container with 2 instances for high availability
  ecs_container_port      = 3000
  ecs_cpu                 = 1024
  ecs_memory              = 2048
  ecs_desired_count       = 2
  
  # Database configuration - medium instance with 50GB storage for staging data
  rds_instance_class      = "db.t3.medium"
  rds_allocated_storage   = 50
  
  # Redis configuration - medium cache with 2 nodes for session management
  redis_node_type         = "cache.t3.medium"
  redis_num_cache_nodes   = 2
}

# Output the staging ALB DNS for application access
output "application_url" {
  value       = module.root.alb_dns_name
  description = "Application load balancer URL for the staging environment"
}

# Output VPC ID for reference by other resources
output "vpc_id" {
  value       = module.root.vpc_id
  description = "VPC ID of the staging environment"
}