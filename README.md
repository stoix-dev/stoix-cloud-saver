# Pulumi Project Setup and Integration with DigitalOcean CLI (`doctl`)

This document provides a step-by-step guide on how to start and set up a Pulumi project and integrate it with the DigitalOcean CLI (`doctl`) for managing infrastructure on DigitalOcean.

## Prerequisites

Before you begin, ensure you have the following tools installed on your machine:

- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/)
- [Node.js](https://nodejs.org/) (Required if using JavaScript/TypeScript for Pulumi)
- [Python](https://www.python.org/downloads/) (Required if using Python for Pulumi)
- [doctl](https://docs.digitalocean.com/reference/doctl/how-to/install/) (DigitalOcean CLI)
- [Git](https://git-scm.com/downloads)

## Step 1: Install Pulumi

Follow the official Pulumi installation guide to install Pulumi on your system. You can verify the installation by running:

```bash
pulumi version
mkdir my-pulumi-project
cd my-pulumi-project
```
## Step 2: Set Up a New Pulumi Project

```bash
pulumi new typescript
```
## Step 3: Install doctl

```bash
doctl version
```

## Authenticate doctl with your DigitalOcean account

```bash
doctl auth init
```

