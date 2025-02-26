# Root variables configuration file for the User Management Dashboard infrastructure deployment
# This file defines common variables used across all Terraform modules

variable "environment" {
  type        = string
  description = "Environment name for deployment (dev, staging, prod)"
}

variable "aws_region" {
  type        = string
  description = "AWS region for resource deployment"
  default     = "us-west-2"
}

variable "app_name" {
  type        = string
  description = "Application name for resource tagging"
  default     = "user-management-dashboard"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for multi-AZ deployment"
}

variable "ecs_container_port" {
  type        = number
  description = "Container port for the application"
  default     = 3000
}

variable "ecs_cpu" {
  type        = number
  description = "CPU units for ECS tasks"
  default     = 1024  # 1 vCPU
}

variable "ecs_memory" {
  type        = number
  description = "Memory allocation for ECS tasks"
  default     = 2048  # 2 GB
}

variable "ecs_desired_count" {
  type        = number
  description = "Desired number of ECS tasks"
  default     = 2  # Minimum 2 tasks for high availability
}

variable "rds_instance_class" {
  type        = string
  description = "RDS instance type"
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  type        = number
  description = "Storage allocation for RDS instance"
  default     = 20  # 20 GB
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache Redis node type"
  default     = "cache.t3.small"
}

variable "redis_num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in the Redis cluster"
  default     = 1
}