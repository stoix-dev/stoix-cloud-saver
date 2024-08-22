#!/bin/bash

# exit if a command returns a non-zero exit code and also print the commands and their args as they are executed
set -e -x
# Download and install required tools.
# pulumi
curl -fsSL https://get.pulumi.com/ | bash
export PATH=$PATH:$HOME/.pulumi/bin
# Login into pulumi. This will require the PULUMI_ACCESS_TOKEN environment variable
pulumi login
# update the GitLab Runner's packages
apt-get update -y
apt-get install sudo ca-certificates curl gnupg -y
# nodejs
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
NODE_MAJOR=20
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
wget https://github.com/digitalocean/doctl/releases/download/v1.110.0/doctl-1.110.0-linux-amd64.tar.gz
tar xf ~/doctl-1.110.0-linux-amd64.tar.gz
sudo mv ~/doctl /usr/local/bin

apt-get update -y
apt-get install -y nodejs
