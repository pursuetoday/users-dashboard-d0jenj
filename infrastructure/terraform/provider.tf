# Terraform provider configuration for User Management Dashboard
# Defines AWS provider and required versions for infrastructure deployment

terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws" # v5.0
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random" # v3.0
      version = "~> 3.0"
    }
  }
}

# Configure the AWS Provider with region and default tags
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment         = var.environment
      Project             = var.app_name
      ManagedBy           = "terraform"
      SecurityCompliance  = "required"
      DataClassification  = "sensitive"
      BackupRequired      = "true"
      MonitoringRequired  = "true"
    }
  }
}