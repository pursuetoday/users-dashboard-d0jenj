# Production environment Terraform variables for User Management Dashboard
# High availability and scaling configuration for production workloads

# Environment configuration
environment         = "prod"
aws_region          = "us-west-2"
app_name            = "user-management-dashboard"

# Network configuration
vpc_cidr            = "10.0.0.0/16"
availability_zones  = ["us-west-2a", "us-west-2b", "us-west-2c"]

# ECS configuration
ecs_container_port  = 3000
ecs_cpu             = 1024  # 1 vCPU
ecs_memory          = 2048  # 2 GB
ecs_desired_count   = 3     # 3 tasks for high availability

# RDS configuration
rds_instance_class    = "db.t3.large"
rds_allocated_storage = 100  # 100 GB

# Redis configuration
redis_node_type       = "cache.t3.medium"
redis_num_cache_nodes = 2  # 2 nodes for high availability