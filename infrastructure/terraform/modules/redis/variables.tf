# Infrastructure - Redis ElastiCache Module Variables
# Defines configuration parameters for a highly available Redis cluster with encryption and security controls

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "redis_node_type" {
  type        = string
  description = "The compute and memory capacity of the nodes"
  default     = "cache.t3.micro"
}

variable "redis_port" {
  type        = number
  description = "Port number for Redis cluster"
  default     = 6379
}

variable "redis_num_cache_clusters" {
  type        = number
  description = "Number of cache clusters (nodes) in the replication group"
  default     = 2
  validation {
    condition     = var.redis_num_cache_clusters >= 2
    error_message = "At least 2 cache clusters are required for high availability"
  }
}

variable "redis_parameter_family" {
  type        = string
  description = "Redis parameter group family"
  default     = "redis7"
}

variable "redis_engine_version" {
  type        = string
  description = "Redis engine version"
  default     = "7.0"
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all resources"
  default     = {}
}