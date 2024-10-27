import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import * as k8shelm from "@pulumi/kubernetes/helm/v3";
import * as k8s from "@pulumi/kubernetes";
const config = new pulumi.Config()
const dnsName = config.require("dnsName")
const email = config.require("email")
const imageName = config.require("imageName")
const domainName = config.require("domainName")

const provider = new digitalocean.Provider("do-provider", {
    token: process.env.DIGITALOCEAN_TOKEN,
});

//  echo $HOME/.kube/config  for Linux/Mac
const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: process.env.KUBECONFIG_PATH,
});



const ingressNamespace = new k8s.core.v1.Namespace("nginx-ingress", {
    metadata: {
        name: "nginx-ingress",
    },
});

const nginxIngressController = new k8shelm.Chart("nginx-ingress", {
    chart: "ingress-nginx",
    version: "4.10.3", // Replace with the latest stable version
    fetchOpts: {
        repo: "https://kubernetes.github.io/ingress-nginx",
    },
    namespace: ingressNamespace.metadata.name,
    values: {
        controller: {
            service: {
                type: "LoadBalancer", // Use "LoadBalancer" for public access or "ClusterIP" for internal access.    
            },
        },
    },
});



const certManager = new k8shelm.Chart("cert-manager", {
    chart: "cert-manager",
    version: "v1.11.1", // Replace with the latest stable version
    fetchOpts: {
        repo: "https://charts.jetstack.io",
    },
    namespace: "default",
    values: {
        installCRDs: true, // This installs the Custom Resource Definitions (CRDs) needed by cert-manager
    },
});


// ClusterIssuer definition for Let's Encrypt (staging)
const clusterIssuer = new k8s.apiextensions.CustomResource("letsencrypt-cluster-issuer", {
    apiVersion: "cert-manager.io/v1",
    kind: "ClusterIssuer",
    metadata: {
        name: "letsencrypt",
    },
    spec: {
        acme: {
            email: email, // Seu email
            server: "https://acme-v02.api.letsencrypt.org/directory",
            privateKeySecretRef: {
                name: "letsencrypt", // Nome do secret onde será armazenada a chave privada
            },
            solvers: [
                {
                    http01: {
                        ingress: {
                            class: "nginx", // Usando Ingress NGINX para http-01
                        },
                    },
                },
                {
                    dns01: {
                        digitalocean: {
                            tokenSecretRef: {
                                name: "digitalocean-dns", // Nome do secret contendo o token da DigitalOcean
                                key: "access-token", // Chave dentro do secret com o token
                            },
                        },
                    },
                },
            ],
        },
    },
});




const certificate = new k8s.apiextensions.CustomResource("cert", {
    apiVersion: "cert-manager.io/v1",
    kind: "Certificate",
    metadata: {
        name: "cert",
        namespace: "default", // Replace with your namespace if different
    },
    spec: {
        secretName: "cert-tls", // Name of the secret where the certificate will be stored
        issuerRef: {
            name: "letsencrypt", // ClusterIssuer name
            kind: "ClusterIssuer",
        },
        commonName: domainName, 
        dnsNames: [
            dnsName 
        ],
    },
});


const registry = new digitalocean.ContainerRegistry("registry", {
    name: "registry",
    subscriptionTierSlug: "basic", // Choose from "starter", "basic", "professional", "enterprise"
});

const frontendLabels = { app: 'frontend' };

const frontendDeployment = new k8s.apps.v1.Deployment('frontend', {
    metadata: {
        name: 'frontend',
        labels: frontendLabels,
    },
    spec: {
        selector: { matchLabels: frontendLabels },
        replicas: 1,
        template: {
            metadata: { labels: frontendLabels },
            spec: {
                containers: [{
                    name: "frontend-container",
                    image: imageName,
                    imagePullPolicy: "IfNotPresent",
                    ports: [{ containerPort: 3000 }]  
                }],

                imagePullSecrets: [{
                    name: "registry"
                }]

            }

        }
    }
});

// Backend Service
const frontendService = new k8s.core.v1.Service('service-frontend', {
    metadata: { name: "service-frontend" },
    spec: {
        type: "ClusterIP",
        ports: [{ port: 3000, targetPort: 3000, protocol: "TCP" }],
        selector: frontendLabels,
    }
});


const ingress = new k8s.networking.v1.Ingress("ingress", {
    metadata: {
        name: "ingress",
        annotations: {
            "kubernetes.io/ingress.class": "nginx",
            "cert-manager.io/cluster-issuer": "letsencrypt",
        },
    },
    spec: {
        rules: [
    {
                host: "atendimento.fabricaleads.com.br",
                http: {
                    paths: [
                        {
                            path: "/",
                            pathType: "Prefix",
                            backend: {
                                service: {
                                    name: frontendService.metadata.name,
                                    port: { number: 3000 },
                                },
                            },
                        },
                    ],
                },
            }
        ],
        tls: [
            {
                hosts: [dnsName],
                secretName: "cert-tls",
            },
        ],
    },
}, { provider: k8sProvider });
