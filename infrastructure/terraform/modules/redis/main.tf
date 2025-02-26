# ------------------------------------------------------------------------
# Redis ElastiCache Terraform Module - Main Configuration
# ------------------------------------------------------------------------
# This module provisions a highly available Redis ElastiCache cluster
# with encryption, automatic failover, and comprehensive security controls.
# ------------------------------------------------------------------------

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Define local variables
locals {
  # Determine the name prefix based on the environment
  name_prefix = var.environment == "prod" ? "production" : var.environment
  
  # Redis parameter family
  redis_family = var.redis_parameter_family
  
  # Ensure minimum number of nodes for HA based on environment
  min_nodes = var.environment == "prod" ? 2 : 1
}

# Data sources to fetch existing VPC and subnets
data "aws_vpc" "main" {
  tags = {
    Environment = var.environment
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  
  filter {
    name   = "tag:Type"
    values = ["private"]
  }
}

# Subnet group for Redis cluster placement
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = data.aws_subnets.private.ids
  
  tags = merge(var.tags, {
    Name      = "${local.name_prefix}-redis-subnet-group"
    ManagedBy = "terraform"
  })
}

# Parameter group for Redis configuration
resource "aws_elasticache_parameter_group" "main" {
  family      = local.redis_family
  name        = "${local.name_prefix}-redis-params"
  description = "Custom Redis parameters for ${var.environment} environment"
  
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }
  
  parameter {
    name  = "timeout"
    value = "300"
  }
  
  tags = merge(var.tags, {
    Name      = "${local.name_prefix}-redis-params"
    ManagedBy = "terraform"
  })
}

# Security group for Redis
resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  vpc_id      = data.aws_vpc.main.id
  description = "Security group for Redis cluster in ${var.environment}"
  
  ingress {
    from_port   = var.redis_port
    to_port     = var.redis_port
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
    description = "Allow Redis port access from VPC"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }
  
  tags = merge(var.tags, {
    Name      = "${local.name_prefix}-redis-sg"
    ManagedBy = "terraform"
  })
}

# Generate secure password for Redis auth token
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
  
  # Recreate the token when the replication group ID changes
  keepers = {
    replication_group_id = "${local.name_prefix}-redis"
  }
}

# Redis ElastiCache replication group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${local.name_prefix}-redis"
  description                = "Redis cluster for ${var.environment} environment"
  node_type                  = var.redis_node_type
  port                       = var.redis_port
  parameter_group_name       = aws_elasticache_parameter_group.main.name
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  
  # High Availability settings
  automatic_failover_enabled = true
  multi_az_enabled           = true
  num_cache_clusters         = max(local.min_nodes, var.redis_num_cache_clusters)
  
  # Redis settings
  engine                     = "redis"
  engine_version             = var.redis_engine_version
  
  # Security settings
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result
  
  # Maintenance settings
  maintenance_window         = "sun:05:00-sun:09:00"
  snapshot_window            = "00:00-04:00"
  snapshot_retention_limit   = var.environment == "prod" ? 7 : 1
  
  tags = merge(var.tags, {
    Name      = "${local.name_prefix}-redis"
    ManagedBy = "terraform"
  })
}

# Outputs
output "redis_endpoint" {
  description = "Redis connection endpoints for the application"
  value = {
    primary_endpoint_address = aws_elasticache_replication_group.main.primary_endpoint_address
    reader_endpoint_address  = aws_elasticache_replication_group.main.reader_endpoint_address
    port                     = aws_elasticache_replication_group.main.port
  }
}

output "security" {
  description = "Security configuration for Redis"
  value = {
    security_group_id = aws_security_group.redis.id
    auth_token        = random_password.redis_auth_token.result
  }
  sensitive = true
}