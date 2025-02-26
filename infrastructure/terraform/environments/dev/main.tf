# Development environment-specific Terraform configuration for the User Management Dashboard
# This configuration instantiates the root module with development parameters for minimal
# resource allocation and basic redundancy in a development environment

terraform {
  required_version = ">= 1.0.0"
  
  # S3 backend configuration for development environment state storage
  backend "s3" {
    bucket         = "user-management-dashboard-tfstate-dev"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-dev"
  }
}

# AWS provider configuration with development-specific tags
provider "aws" {
  region = "us-east-1"
  
  default_tags {
    tags = {
      Environment  = "dev"
      Project      = "user-management-dashboard"
      ManagedBy    = "terraform"
      CostCenter   = "development"
      AutoShutdown = "true"
    }
  }
}

# Root module instantiation with development environment variables
module "root" {
  source = "../.."
  
  # Environment settings
  environment = "dev"
  aws_region  = "us-east-1"
  app_name    = "user-management-dashboard"
  
  # Network configuration with dual availability zones for basic redundancy
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
  
  # ECS configuration with minimal resources for development environment
  ecs_container_port = 3000
  ecs_cpu            = 256     # 0.25 vCPU for development
  ecs_memory         = 512     # 0.5 GB for development
  ecs_desired_count  = 1       # Single instance for development
  ecs_max_count      = 2       # Allow scaling to 2 instances maximum
  ecs_min_count      = 1       # Minimum 1 instance
  
  # RDS configuration with smaller instance class for development
  rds_instance_class         = "db.t3.small"  # Smaller instance for development
  rds_allocated_storage      = 20             # 20 GB storage
  rds_max_allocated_storage  = 50             # Allow growth to 50 GB
  rds_backup_retention_period = 7             # 7 days backup retention
  
  # Redis configuration with minimal resources for development
  redis_node_type                 = "cache.t3.micro"  # Minimal Redis instance
  redis_num_cache_nodes           = 1                 # Single node for development
  redis_automatic_failover_enabled = false            # No failover needed in development
  
  # Development-specific settings to reduce costs and enable easier resource management
  enable_deletion_protection = false    # Allow resource deletion in development
  enable_performance_insights = true    # Enable performance insights for debugging
  enable_enhanced_monitoring  = false   # Disable enhanced monitoring to reduce costs
  
  # Maintenance windows during off-hours
  backup_window      = "03:00-04:00"          # Backup between 3-4 AM
  maintenance_window = "Mon:04:00-Mon:05:00"  # Maintenance on Monday 4-5 AM
}

# Expose important outputs from the root module for reference
output "vpc_id" {
  value       = module.root.vpc_id
  description = "VPC ID created for the development environment"
}

output "alb_dns_name" {
  value       = module.root.alb_dns_name
  description = "Application Load Balancer DNS name for the development environment"
}

output "ecs_cluster_name" {
  value       = module.root.ecs_cluster_name
  description = "ECS Cluster name for the development environment"
}

output "rds_endpoint" {
  value       = module.root.rds_endpoint
  description = "RDS endpoint for database connections in the development environment"
}

output "redis_endpoint" {
  value       = module.root.redis_endpoint
  description = "Redis ElastiCache endpoint for cache connections in the development environment"
}