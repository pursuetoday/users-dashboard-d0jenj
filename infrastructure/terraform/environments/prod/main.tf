# Production environment Terraform configuration for User Management Dashboard
# Configured for high availability, security, and scalability in production environment

terraform {
  required_version = ">= 1.0.0"
  
  # Production-specific backend configuration for state management
  # Using S3 with encryption, versioning, and DynamoDB locking for collaboration
  backend "s3" {
    bucket                  = "user-management-dashboard-tfstate-prod"
    key                     = "terraform.tfstate"
    region                  = "us-east-1"
    encrypt                 = true
    dynamodb_table          = "terraform-state-lock-prod"
    kms_key_id              = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/PROD_KEY_ID"
    versioning              = true
    server_side_encryption  = "aws:kms"
  }
}

# AWS provider configuration with production-grade security tags
provider "aws" {
  region = "us-east-1"
  
  default_tags {
    tags = {
      Environment         = "prod"
      Project             = "user-management-dashboard"
      ManagedBy           = "terraform"
      BusinessUnit        = "operations"
      DataClassification  = "confidential"
      Backup              = "enabled"
    }
  }
}

# Root module instantiation for production environment with high-availability configuration
module "root" {
  source = "../../../"
  
  # Environment settings
  environment = "prod"
  aws_region  = "us-east-1"
  app_name    = "user-management-dashboard"
  
  # Network configuration for multi-AZ deployment
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  
  # ECS configuration for production workloads with high availability
  ecs_container_port = 3000
  ecs_cpu            = 1024  # 1 vCPU
  ecs_memory         = 2048  # 2 GB
  ecs_desired_count  = 3     # 3 tasks for high availability
  ecs_max_capacity   = 10    # Auto-scaling up to 10 instances during peak loads
  ecs_min_capacity   = 2     # Ensuring at least 2 instances for high availability
  
  # RDS configuration for production database with redundancy
  rds_instance_class          = "db.t3.large"
  rds_allocated_storage       = 50
  rds_max_allocated_storage   = 100  # Allow storage auto-scaling up to 100GB
  rds_multi_az                = true  # Multi-AZ deployment for high availability
  rds_backup_retention_period = 30    # 30 days backup retention for compliance
  
  # Redis configuration for production caching and session storage
  redis_node_type           = "cache.t3.medium"
  redis_num_cache_nodes     = 3       # 3 nodes across 3 AZs for high availability
  redis_automatic_failover  = true    # Enable automatic failover for Redis cluster
  
  # Security and monitoring enhancements for production
  enable_waf                  = true  # Enable WAF for application protection
  enable_shield               = true  # Enable Shield for DDoS protection
  enable_enhanced_monitoring  = true  # Enhanced monitoring for better observability
  enable_performance_insights = true  # Performance insights for database optimization
}

# Output VPC ID for reference by other stacks
output "vpc_id" {
  value       = module.root.vpc_id
  description = "Production VPC identifier for network integration"
}

# Output ALB DNS name for application access and DNS configuration
output "alb_dns_name" {
  value       = module.root.alb_dns_name
  description = "Production ALB DNS name for DNS configuration"
}