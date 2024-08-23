#!/bin/bash

# Setup the DigitalOcean CLI (doctl) with the API token
echo "Configuring DigitalOcean CLI with the secure token..."
export DIGITALOCEAN_TOKEN=$1  # Take token as an argument
export DIGITALOCEAN_USERNAME=$2
export DOCKER_REGISTRY=$3
doctl auth init --access-token $DIGITALOCEAN_TOKEN
docker login -u $DIGITALOCEAN_USERNAME -p $DIGITALOCEAN_TOKEN registry.digitalocean.com

# Validate the token and set up context
echo "Token validation and context setup complete."
sudo docker push registry.digitalocean.com/$DOCKER_REGISTRY/stoix-cloud-saver-web-next-app

