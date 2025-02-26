terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Default application port since it's not in variables
locals {
  app_port = 3000 # Default port for Node.js applications
}

# Create VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(
    {
      Name          = "${var.environment}-vpc"
      Environment   = var.environment
      CostCenter    = "infrastructure"
      BackupPolicy  = "daily"
      ComplianceTier = "high"
      ManagedBy     = "terraform"
    },
    var.tags
  )
}

# Create Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    {
      Name        = "${var.environment}-igw"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# Create Public Subnets
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    {
      Name        = format("%s-public-subnet-%s", var.environment, count.index + 1)
      Environment = var.environment
      Type        = "public"
      AZ          = var.availability_zones[count.index]
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# Create Private Subnets
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(
    {
      Name        = format("%s-private-subnet-%s", var.environment, count.index + 1)
      Environment = var.environment
      Type        = "private"
      AZ          = var.availability_zones[count.index]
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# Create Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? length(var.availability_zones) : 0
  vpc   = true

  tags = merge(
    {
      Name        = format("%s-nat-eip-%s", var.environment, count.index + 1)
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )

  depends_on = [aws_internet_gateway.main]
}

# Create NAT Gateways
resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? length(var.availability_zones) : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(
    {
      Name        = format("%s-nat-gateway-%s", var.environment, count.index + 1)
      Environment = var.environment
      AZ          = var.availability_zones[count.index]
      ManagedBy   = "terraform"
    },
    var.tags
  )

  depends_on = [aws_internet_gateway.main]
}

# Create Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    {
      Name        = "${var.environment}-public-rt"
      Environment = var.environment
      Type        = "public"
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# Create Public Route to Internet Gateway
resource "aws_route" "public_internet_gateway" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

# Create Private Route Tables
resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  tags = merge(
    {
      Name        = format("%s-private-rt-%s", var.environment, count.index + 1)
      Environment = var.environment
      Type        = "private"
      AZ          = var.availability_zones[count.index]
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# Add routes to private route tables if NAT Gateway is enabled
resource "aws_route" "private_nat_gateway" {
  count                  = var.enable_nat_gateway ? length(var.availability_zones) : 0
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[count.index].id
}

# Associate Public Subnets with Public Route Table
resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Associate Private Subnets with Private Route Tables
resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Create Application Load Balancer Security Group
resource "aws_security_group" "alb" {
  name        = "${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from internet (redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Define simple egress to all destinations initially to avoid circular dependency
  egress {
    description = "Outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    {
      Name         = "${var.environment}-alb-sg"
      Environment  = var.environment
      SecurityTier = "public"
      ManagedBy    = "terraform"
    },
    var.tags
  )

  lifecycle {
    create_before_destroy = true
  }
}

# Create ECS Service Security Group
resource "aws_security_group" "ecs" {
  name        = "${var.environment}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    {
      Name         = "${var.environment}-ecs-sg"
      Environment  = var.environment
      SecurityTier = "private"
      ManagedBy    = "terraform"
    },
    var.tags
  )

  lifecycle {
    create_before_destroy = true
  }
}

# Add ingress rule to ECS security group from ALB
resource "aws_security_group_rule" "ecs_from_alb" {
  type                     = "ingress"
  from_port                = local.app_port
  to_port                  = local.app_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.alb.id
  description              = "Application traffic from ALB"
}

# Restrict ALB egress to only ECS security group (replace the default egress)
resource "aws_security_group_rule" "alb_to_ecs" {
  type                     = "egress"
  from_port                = local.app_port
  to_port                  = local.app_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.alb.id
  source_security_group_id = aws_security_group.ecs.id
  description              = "Outbound to ECS tasks only"
}

# Output the VPC and security groups according to the JSON specification
output "vpc" {
  description = "Main VPC resource for the environment"
  value = {
    id         = aws_vpc.main.id
    cidr_block = aws_vpc.main.cidr_block
  }
}

output "security_groups" {
  description = "Security groups for ALB and ECS tasks"
  value = {
    alb_id = aws_security_group.alb.id
    ecs_id = aws_security_group.ecs.id
  }
}

# Additional outputs for convenience
output "public_subnet_ids" {
  description = "List of IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of IDs of private subnets"
  value       = aws_subnet.private[*].id
}