#!/bin/bash
set -e -x

# Add the Pulumi CLI to the PATH
export PATH=$PATH:$HOME/.pulumi/bin

# Navigate to the project directory and install dependencies
cd ../
npm install

# Login to Pulumi (assuming PULUMI_ACCESS_TOKEN is already set in the environment)
pulumi login

# Check if the stack exists; if not, create it
STACK_NAME="production"
if pulumi stack select $STACK_NAME --non-interactive; then
    echo "Stack $STACK_NAME selected."
else
    echo "Stack $STACK_NAME does not exist. Creating stack $STACK_NAME."
    pulumi stack init $STACK_NAME
fi

# Update the stack (apply the changes)
pulumi up -y
