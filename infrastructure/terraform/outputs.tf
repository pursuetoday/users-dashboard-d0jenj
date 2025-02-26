# Terraform outputs file exposing critical infrastructure information
# for the User Management Dashboard application

# VPC and Networking outputs
output "vpc_id" {
  value       = module.vpc.vpc_id
  description = "VPC ID for network resource association"
}

output "private_subnets" {
  value       = module.vpc.private_subnets
  description = "Private subnet IDs for internal resource placement"
}

output "public_subnets" {
  value       = module.vpc.public_subnets
  description = "Public subnet IDs for public-facing resources"
}

# Application Load Balancer outputs
output "alb_dns_name" {
  value       = module.alb.dns_name
  description = "Application Load Balancer DNS name for application access"
}

# ECS Cluster outputs
output "ecs_cluster_name" {
  value       = module.ecs.cluster_name
  description = "ECS cluster name for container deployments"
}

# Database outputs
output "rds_endpoint" {
  value       = module.rds.endpoint
  description = "RDS PostgreSQL endpoint for database connections"
}

output "redis_endpoint" {
  value       = module.elasticache.endpoint
  description = "Redis ElastiCache endpoint for caching connections"
}

# CDN outputs
output "cloudfront_domain" {
  value       = module.cloudfront.domain_name
  description = "CloudFront distribution domain name for CDN access"
}

# Service Discovery outputs
output "service_discovery_namespace" {
  value       = aws_service_discovery_private_dns_namespace.main.name
  description = "Service discovery namespace for container service discovery"
}

# Monitoring outputs
output "monitoring_endpoint" {
  value       = module.monitoring.endpoint
  description = "Monitoring endpoint for system metrics and alerting access"
}