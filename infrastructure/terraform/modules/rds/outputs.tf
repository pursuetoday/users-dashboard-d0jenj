output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance, used for application database connectivity"
  value       = aws_db_instance.this.endpoint
}

output "db_instance_port" {
  description = "The port number on which the RDS instance is accepting connections"
  value       = aws_db_instance.this.port
}

output "db_instance_id" {
  description = "The unique identifier of the RDS instance for resource management and operations"
  value       = aws_db_instance.this.id
}

output "db_instance_arn" {
  description = "The Amazon Resource Name (ARN) of the RDS instance for IAM and monitoring integration"
  value       = aws_db_instance.this.arn
}

output "security_group_id" {
  description = "The ID of the security group controlling network access to the RDS instance"
  value       = aws_security_group.rds.id
}