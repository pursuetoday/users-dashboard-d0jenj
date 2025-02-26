output "cluster_arn" {
  description = "ARN of the ECS cluster for service associations and IAM permissions"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster for service configurations and task definitions"
  value       = aws_ecs_cluster.main.name
}

output "service_id" {
  description = "ID of the ECS service for task management and updates"
  value       = aws_ecs_service.main.id
}

output "service_name" {
  description = "Name of the ECS service for task management and service discovery"
  value       = aws_ecs_service.main.name
}

output "lb_dns_name" {
  description = "DNS name of the load balancer for application access and service discovery"
  value       = aws_lb.main.dns_name
}