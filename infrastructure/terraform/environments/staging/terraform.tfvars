# Terraform variable definitions for the staging environment deployment
# of the User Management Dashboard

# Environment identification
environment = "staging"
aws_region = "us-west-2"
app_name = "user-management-dashboard"

# Network configuration
vpc_cidr = "10.1.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b"]

# ECS configuration
ecs_container_port = 3000
ecs_cpu = 1024
ecs_memory = 2048
ecs_desired_count = 2

# RDS configuration
rds_instance_class = "db.t3.medium"
rds_allocated_storage = 50

# Redis configuration
redis_node_type = "cache.t3.medium"
redis_num_cache_nodes = 2