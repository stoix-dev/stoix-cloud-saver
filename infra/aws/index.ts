import * as eks from "@pulumi/eks";
import * as pulumi from "@pulumi/pulumi";
import { AppDeployment, ClusterServices } from "@stoix/infra-shared";

// Thin AWS module. Structure is identical across every cloud module:
// (read config) -> (provision cluster) -> (k8s provider) -> (ClusterServices)
// -> (AppDeployment) -> (exports). That parallel shape is the portability story.

// 1. Read config. Only non-secret values; AWS creds come from env.
const config = new pulumi.Config();
const region = config.require("region");
const instanceType = config.require("instanceType");
const desiredCapacity = config.requireNumber("desiredCapacity");
const minSize = config.requireNumber("minSize");
const maxSize = config.requireNumber("maxSize");
const domain = config.require("domain");
const acmeEmail = config.require("acmeEmail");
const image = config.require("image");
const appVersion = config.get("appVersion") ?? "dev";

// 2. Provision the cluster (EKS). Uses the account default VPC and a small
// managed node group; @pulumi/eks wires the control plane and IAM for us.
const cluster = new eks.Cluster("stoix-eks", {
  instanceType,
  desiredCapacity,
  minSize,
  maxSize,
});

// 3. The k8s provider is produced by the EKS component, already bound to the
// new cluster's kubeconfig.
const kubeProvider = cluster.provider;

// 4. Install shared cluster prerequisites (ingress-nginx + cert-manager + issuer).
const clusterServices = new ClusterServices("aws", { kubeProvider, acmeEmail });

// 5. Deploy the shared app onto the cluster.
const app = new AppDeployment(
  "aws",
  {
    image,
    cloud: "aws",
    region,
    appVersion,
    domain,
    kubeProvider,
  },
  { dependsOn: clusterServices },
);

// 6. Exports.
export const kubeconfig = pulumi.secret(cluster.kubeconfig);
export const url = app.url;
