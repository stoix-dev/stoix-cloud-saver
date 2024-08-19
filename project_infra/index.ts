import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import * as kubernetes from "@pulumi/kubernetes";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();
const clusterName = config.require("clusterName");
const nodePool = config.require("nodePool");
const databaseName = config.require("databaseName");
const redisName = config.require("redisName");
const domainName = config.require("domainName");

const cluster = new digitalocean.KubernetesCluster(`${clusterName}`, {
    region: digitalocean.Region.SFO3,
    version: "1.29.6-do.0",
    nodePool: {
        name: nodePool,
        size: "s-2vcpu-4gb",
        nodeCount: 3,
    },
});

//create a postgres database
const postgressDb = new digitalocean.DatabaseCluster(`${databaseName}`, {
    engine: "pg",
    version: "16",
    region: digitalocean.Region.SFO3,
    size: "db-s-1vcpu-1gb",
    nodeCount: 1,
});


// Create a Redis database cluster
const redisDb = new digitalocean.DatabaseCluster(`${redisName}`, {
    engine: "redis",
    version: "6", // Specify the Redis version you want to use
    region: digitalocean.Region.SFO3,
    size: "db-s-1vcpu-2gb",
    nodeCount: 1,
});

//create a docker registry
const containerRegistry = new digitalocean.ContainerRegistry("open-source-project-registry", {
    region: "sfo3",
    name: "open-source-project-registry",
    subscriptionTierSlug: "basic",
});

const frontendLabels = { app: 'next-frontend' };


const frontendDeployment = new k8s.apps.v1.Deployment('next', {
    metadata: {
        name: 'next',
        labels: frontendLabels,
    },
    spec: {
        selector: { matchLabels: frontendLabels },
        replicas: 3,
        template: {
            metadata: { labels: frontendLabels },
            spec: {
                containers: [{
                    name: "next",
                    image: "YOUR_IMAGE",
                    imagePullPolicy: "IfNotPresent",
                    ports: [{ containerPort: 80 }],

                }],
                imagePullSecrets: [{
                    name: "YOUR_SECRET"
                }]
            }

        }
    }
});


// Frontend Service
const frontendService = new k8s.core.v1.Service('next', {
    metadata: { name: "next" },
    spec: {
        type: "ClusterIP",
        ports: [
            { name: "http", port: 80, targetPort: 80, protocol: "TCP", },
        ],
        selector: frontendLabels,
    }
});

// Create a Kubernetes provider
const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: process.env.KUBECONFIG,
});

const certManager = new k8s.helm.v3.Chart("cert-manager", {
    chart: "cert-manager",
    version: "v1.5.3",
    fetchOpts: { repo: "https://charts.jetstack.io" },
    values: {
        installCRDs: true,
    },
}, { provider: k8sProvider, transformations: [replaceOnChanges] });

function replaceOnChanges(args: any) {
    return { ...args, replaceOnChanges: ["spec", "metadata"] };
}

// Set up a ClusterIssuer for Let's Encrypt
const clusterIssuer = new k8s.apiextensions.CustomResource("letsencrypt-clusterissuer", {
    apiVersion: "cert-manager.io/v1",
    kind: "ClusterIssuer",
    metadata: { name: "letsencrypt" },
    spec: {
        acme: {
            server: "https://acme-v02.api.letsencrypt.org/directory",
            email: "example@gmail.com",
            privateKeySecretRef: { name: "letsencrypt-private-key" },
            solvers: [{ http01: { ingress: { class: "nginx" } } }],
        },
    },
}, { provider: k8sProvider });

// Define a certificate for the domain
const certificate = new k8s.apiextensions.CustomResource("next-cert", {
    apiVersion: "cert-manager.io/v1",
    kind: "Certificate",
    metadata: { name: "next-cert" },
    spec: {
        secretName: "next-tls",
        issuerRef: { name: "letsencrypt", kind: "ClusterIssuer" },
        commonName: domainName,
        dnsNames: [domainName],
    },
}, { provider: k8sProvider });


// Define the ingress to route traffic to the service
const ingress = new k8s.networking.v1.Ingress("next-ingress", {
    metadata: {
        name: "next-ingress",
        annotations: {
            "kubernetes.io/ingress.class": "nginx",
            "cert-manager.io/cluster-issuer": "letsencrypt",
        },
    },
    spec: {
        rules: [{
            host: domainName,
            http: {
                paths: [{
                    path: "/",
                    pathType: "Prefix",
                    backend: {
                        service: {
                            name: frontendService.metadata.name,
                            port: { number: 80 },
                        },
                    },
                },
                ],
            },
        }],
        tls: [{
            hosts: [domainName],
            secretName: "next-tls",
        }],
    },
}, { provider: k8sProvider });

