variable "environment" {
  type        = string
  description = "Environment name for RDS resources (dev/staging/prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where RDS will be deployed"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for RDS multi-AZ deployment"
}

variable "instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  type        = number
  description = "Allocated storage size in GB"
  default     = 20
}

variable "max_allocated_storage" {
  type        = number
  description = "Maximum storage limit for autoscaling in GB"
  default     = 100
}

variable "db_username" {
  type        = string
  description = "Master username for PostgreSQL database"
  sensitive   = true
}

variable "db_password" {
  type        = string
  description = "Master password for PostgreSQL database"
  sensitive   = true
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 7
}

variable "allowed_cidr_blocks" {
  type        = list(string)
  description = "List of CIDR blocks allowed to access the RDS instance"
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all RDS resources"
  default     = {}
}