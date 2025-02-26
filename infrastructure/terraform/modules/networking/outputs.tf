# VPC ID output
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

# VPC CIDR block output
output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

# Public subnet IDs output for ALB and other public-facing resources
output "public_subnet_ids" {
  description = "List of IDs of public subnets for load balancers and other public resources"
  value       = aws_subnet.public[*].id
}

# Private subnet IDs output for ECS tasks, databases, and other private resources
output "private_subnet_ids" {
  description = "List of IDs of private subnets for ECS tasks, databases and other private resources"
  value       = aws_subnet.private[*].id
}

# Application Load Balancer security group ID output
output "alb_security_group_id" {
  description = "ID of the security group for the Application Load Balancer"
  value       = aws_security_group.alb.id
}

# ECS tasks security group ID output
output "ecs_security_group_id" {
  description = "ID of the security group for the ECS tasks"
  value       = aws_security_group.ecs.id
}