# Root Terraform configuration file that orchestrates the AWS infrastructure deployment
# for the User Management Dashboard application using modular architecture

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
  
  # Note: Variables cannot be used in the backend configuration.
  # This configuration needs to be updated per environment using -backend-config options
  backend "s3" {
    bucket         = "user-mgmt-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment       = var.environment
      Project           = var.app_name
      ManagedBy         = "terraform"
      Owner             = "platform-team"
      CostCenter        = "platform-infrastructure"
      SecurityCompliance = "required"
    }
  }
}

# Networking module: VPC and networking infrastructure with multi-AZ support
module "networking" {
  source = "./modules/networking"
  
  environment         = var.environment
  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  # Dynamically generate subnet CIDRs based on the number of availability zones
  private_subnet_cidrs = [for i, az in var.availability_zones : cidrsubnet(var.vpc_cidr, 8, i)]
  public_subnet_cidrs  = [for i, az in var.availability_zones : cidrsubnet(var.vpc_cidr, 8, i + length(var.availability_zones))]
  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true
}

# ECS module: ECS cluster and service deployment with auto-scaling
module "ecs" {
  source = "./modules/ecs"
  
  environment             = var.environment
  vpc_id                  = module.networking.vpc_id
  private_subnets         = module.networking.private_subnets
  public_subnets          = module.networking.public_subnets
  container_port          = var.ecs_container_port
  cpu                     = var.ecs_cpu
  memory                  = var.ecs_memory
  desired_count           = var.ecs_desired_count
  # Set scaling limits based on environment
  max_capacity            = var.environment == "production" ? 10 : 4
  min_capacity            = var.ecs_desired_count
  health_check_path       = "/health"
  health_check_interval   = 30
  enable_auto_scaling     = true
  enable_container_insights = true
  enable_execute_command  = var.environment != "production"
}

# RDS module: PostgreSQL RDS instance with Multi-AZ support
module "rds" {
  source = "./modules/rds"
  
  environment             = var.environment
  vpc_id                  = module.networking.vpc_id
  private_subnets         = module.networking.private_subnets
  instance_class          = var.rds_instance_class
  allocated_storage       = var.rds_allocated_storage
  engine_version          = "15.3"
  multi_az                = var.environment == "production"
  backup_retention_period = var.environment == "production" ? 30 : 7
  deletion_protection     = var.environment == "production"
  skip_final_snapshot     = var.environment != "production"
  enable_performance_insights = true
  enable_encryption       = true
  monitoring_interval     = 60
}

# Redis module: Redis ElastiCache cluster for session management
module "redis" {
  source = "./modules/redis"
  
  environment             = var.environment
  vpc_id                  = module.networking.vpc_id
  private_subnets         = module.networking.private_subnets
  node_type               = var.redis_node_type
  num_cache_nodes         = var.redis_num_cache_nodes
  parameter_group_family  = "redis7"
  engine_version          = "7.0"
  port                    = 6379
  maintenance_window      = "sun:05:00-sun:09:00"
  snapshot_retention_limit = var.environment == "production" ? 7 : 1
  snapshot_window         = "00:00-05:00"
  auto_minor_version_upgrade = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}

# Output VPC ID for reference by other stacks
output "vpc_id" {
  value       = module.networking.vpc_id
  description = "VPC identifier for reference by other stacks"
}

# Output ALB DNS name for application access and DNS configuration
output "alb_dns_name" {
  value       = module.ecs.alb_dns_name
  description = "ALB DNS name for application access and DNS configuration"
}