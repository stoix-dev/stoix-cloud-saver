#!/bin/bash
set -e -x

export PATH=$PATH:$HOME/.pulumi/bin

npm install
pulumi login
pulumi stack select homologacao
pulumi preview