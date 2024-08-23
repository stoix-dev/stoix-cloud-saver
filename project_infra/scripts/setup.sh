#!/bin/bash

# Exit if a command returns a non-zero exit code and also print the commands and their args as they are executed
set -e -x

# Download and install required tools.
# Pulumi
curl -fsSL https://get.pulumi.com/ | bash
export PATH=$PATH:$HOME/.pulumi/bin

# Login into Pulumi. This will require the PULUMI_ACCESS_TOKEN environment variable
pulumi login

# Update the system's packages
sudo apt-get update -y
sudo apt-get install sudo ca-certificates curl gnupg lsb-release -y

# Node.js
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
NODE_MAJOR=20
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

# DigitalOcean CLI (doctl)
wget https://github.com/digitalocean/doctl/releases/download/v1.110.0/doctl-1.110.0-linux-amd64.tar.gz
tar xf doctl-1.110.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Install nodejs
sudo apt-get update -y
sudo apt-get install -y nodejs

# Docker
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update -y
sudo apt-get install -y docker-ce

# Docker Compose
DOCKER_COMPOSE_VERSION=2.20.2
sudo curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify Docker and Docker Compose installation
docker --version
docker-compose --version
