# This file contains development-specific variable values optimized for local development and testing

# Environment Identification
environment       = "dev"
aws_region        = "us-east-1"
app_name          = "user-management-dashboard"

# Networking Configuration
vpc_cidr          = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]

# ECS Configuration - Development optimized (lower resources)
ecs_configuration = {
  container_port = 3000
  cpu            = 256    # 0.25 vCPU - reduced size for dev environment
  memory         = 512    # 0.5 GB - reduced size for dev environment
  desired_count  = 1      # Single instance for development
}

# RDS Configuration - Development optimized
rds_configuration = {
  instance_class    = "db.t3.small"    # Smaller instance for cost savings
  allocated_storage = 20               # 20 GB storage
}

# Redis Configuration - Development optimized
redis_configuration = {
  node_type       = "cache.t3.micro"  # Smaller node type for cost savings
  num_cache_nodes = 1                 # Single node configuration
}