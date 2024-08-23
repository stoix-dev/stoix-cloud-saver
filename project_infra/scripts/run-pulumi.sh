#!/bin/bash
set -e -x

# Add the pulumi CLI to the PATH
export PATH=$PATH:$HOME/.pulumi/bin
cd ../
npm install
pulumi login
pulumi stack select production
pulumi up -y