# Variables for ECS Fargate module
# Defines configuration parameters for cluster, task definitions, services, and auto-scaling

variable "aws_region" {
  type        = string
  description = "AWS region for ECS cluster deployment"
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be a valid region identifier (e.g., us-west-2)"
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "cluster_name" {
  type        = string
  description = "Name of the ECS cluster"
}

variable "task_cpu" {
  type        = number
  description = "CPU units for the ECS task (1 vCPU = 1024 units)"
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.task_cpu)
    error_message = "Task CPU must be a valid Fargate CPU value"
  }
}

variable "task_memory" {
  type        = number
  description = "Memory allocation for the ECS task in MiB"
  default     = 2048
  validation {
    condition     = contains([512, 1024, 2048, 3072, 4096, 5120, 6144, 7168, 8192], var.task_memory)
    error_message = "Task memory must be a valid Fargate memory value"
  }
}

variable "desired_count" {
  type        = number
  description = "Desired number of tasks to run (minimum 2 for high availability)"
  default     = 2
  validation {
    condition     = var.desired_count >= 2 && var.desired_count <= 10
    error_message = "Desired count must be between 2 and 10 for high availability"
  }
}

variable "container_definitions" {
  type        = string
  description = "JSON string of container definitions including security and monitoring configurations"
  validation {
    condition     = can(jsondecode(var.container_definitions))
    error_message = "Container definitions must be a valid JSON string"
  }
}