# Backend configuration for Terraform state management
# Uses S3 for remote state storage and DynamoDB for state locking
# 
# This configuration defines how Terraform state is stored and locked:
# - S3 bucket for durable and versioned state storage
# - DynamoDB table for state locking to prevent concurrent modifications
# - Encryption enabled for security of sensitive information in the state

terraform {
  # AWS S3 backend configuration with state locking via DynamoDB
  backend "s3" {
    # Note: Terraform doesn't allow variables in backend configuration
    # The values below use placeholders that must be provided during initialization
    # bucket = "${var.app_name}-${var.environment}-terraform-state"
    key            = "terraform.tfstate"
    # region = var.aws_region
    encrypt        = true
    # dynamodb_table = "${var.app_name}-${var.environment}-terraform-locks"
  }

  # Define required providers with version constraints
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# AWS Provider configuration
provider "aws" {
  region = var.aws_region
}

# Usage Instructions:
# ------------------
# Initialize with dynamic values using the following command:
# terraform init \
#   -backend-config="bucket=${app_name}-${environment}-terraform-state" \
#   -backend-config="dynamodb_table=${app_name}-${environment}-terraform-locks" \
#   -backend-config="region=${aws_region}"
#
# Example for development environment with default values:
# terraform init \
#   -backend-config="bucket=user-management-dashboard-dev-terraform-state" \
#   -backend-config="dynamodb_table=user-management-dashboard-dev-terraform-locks" \
#   -backend-config="region=us-west-2"
#
# Prerequisites:
# 1. Create the S3 bucket with versioning enabled before initialization
#    (aws s3api create-bucket --bucket user-management-dashboard-dev-terraform-state 
#     --region us-west-2 --create-bucket-configuration LocationConstraint=us-west-2)
#
# 2. Enable versioning on the S3 bucket
#    (aws s3api put-bucket-versioning --bucket user-management-dashboard-dev-terraform-state 
#     --versioning-configuration Status=Enabled)
#
# 3. Create the DynamoDB table with a primary key named "LockID" of type String
#    (aws dynamodb create-table --table-name user-management-dashboard-dev-terraform-locks 
#     --attribute-definitions AttributeName=LockID,AttributeType=S 
#     --key-schema AttributeName=LockID,KeyType=HASH 
#     --billing-mode PAY_PER_REQUEST)
#
# 4. Ensure proper IAM permissions to access both the S3 bucket and DynamoDB table