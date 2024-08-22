#!/bin/bash

# Setup the DigitalOcean CLI (doctl) with the API token
echo "Configuring DigitalOcean CLI with the secure token..."
export DIGITALOCEAN_TOKEN=$1  # Take token as an argument
doctl auth init --access-token $DIGITALOCEAN_TOKEN

# Validate the token and set up context
echo "Token validation and context setup complete."
