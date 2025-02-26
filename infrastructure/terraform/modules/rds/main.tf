# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# RDS PostgreSQL instance
resource "aws_db_instance" "this" {
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = var.instance_class
  allocated_storage       = var.allocated_storage
  max_allocated_storage   = var.max_allocated_storage
  storage_type            = "gp3"
  storage_encrypted       = true
  multi_az                = true
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"
  auto_minor_version_upgrade = true
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = format("%s-%s-final", var.environment, timestamp())
  monitoring_interval     = 60
  monitoring_role_arn     = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  tags = merge(var.tags, { Name = format("%s-rds", var.environment) })
}

# DB subnet group for multi-AZ deployment
resource "aws_db_subnet_group" "this" {
  name       = format("%s-rds-subnet-group", var.environment)
  subnet_ids = var.private_subnet_ids
  tags = merge(var.tags, { Name = format("%s-rds-subnet-group", var.environment) })
}

# Security group for RDS
resource "aws_security_group" "rds" {
  name   = format("%s-rds-sg", var.environment)
  vpc_id = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "PostgreSQL access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(var.tags, { Name = format("%s-rds-sg", var.environment) })
}

# IAM role for RDS enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = format("%s-rds-monitoring-role", var.environment)
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, { Name = format("%s-rds-monitoring-role", var.environment) })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Outputs
output "endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.this.endpoint
}

output "port" {
  description = "The port on which the RDS instance accepts connections"
  value       = aws_db_instance.this.port
}

output "id" {
  description = "The ID of the RDS instance"
  value       = aws_db_instance.this.id
}

output "arn" {
  description = "The ARN of the RDS instance"
  value       = aws_db_instance.this.arn
}

output "db_subnet_group_id" {
  description = "The ID of the DB subnet group"
  value       = aws_db_subnet_group.this.id
}

output "db_subnet_group_arn" {
  description = "The ARN of the DB subnet group"
  value       = aws_db_subnet_group.this.arn
}

output "security_group_id" {
  description = "The ID of the security group for RDS"
  value       = aws_security_group.rds.id
}

output "security_group_arn" {
  description = "The ARN of the security group for RDS"
  value       = aws_security_group.rds.arn
}