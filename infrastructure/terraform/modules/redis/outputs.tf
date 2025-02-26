# ------------------------------------------------------------------------
# Redis ElastiCache Terraform Module - Outputs
# ------------------------------------------------------------------------
# This file defines the output values exposed by the Redis module
# for consumption by other modules in the infrastructure.
# ------------------------------------------------------------------------

output "redis_endpoint" {
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  description = "Primary endpoint address for Redis cluster write operations and general connectivity"
}

output "redis_reader_endpoint" {
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
  description = "Reader endpoint address for Redis cluster read-only operations in high-availability setup"
}

output "redis_port" {
  value       = aws_elasticache_replication_group.main.port
  description = "Port number for establishing Redis cluster connections"
}

output "redis_security_group_id" {
  value       = aws_security_group.redis.id
  description = "ID of the security group controlling network access to the Redis cluster"
}

output "redis_auth_token" {
  value       = random_password.redis_auth_token.result
  description = "Authentication token for secure Redis cluster access - required for connection"
  sensitive   = true
}