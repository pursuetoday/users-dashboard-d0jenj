variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, staging, prod)"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for subnet distribution"
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones must be specified for high availability"
  }
}

variable "private_subnets" {
  type        = list(string)
  description = "List of CIDR blocks for private subnets"
  validation {
    condition     = length(var.private_subnets) >= 2
    error_message = "At least two private subnets must be specified for high availability"
  }
}

variable "public_subnets" {
  type        = list(string)
  description = "List of CIDR blocks for public subnets"
  validation {
    condition     = length(var.public_subnets) >= 2
    error_message = "At least two public subnets must be specified for high availability"
  }
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Whether to create NAT Gateway for private subnets"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Additional tags for all networking resources"
  default     = {}
}