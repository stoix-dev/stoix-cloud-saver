import * as digitalocean from "@pulumi/digitalocean";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { AppDeployment, ClusterServices } from "@stoix/infra-shared";

// Thin DigitalOcean module. Structure is identical across every cloud module:
// (read config) -> (provision cluster) -> (k8s provider) -> (ClusterServices)
// -> (AppDeployment) -> (exports). That parallel shape is the portability story.

// 1. Read config. Only non-secret values; DIGITALOCEAN_TOKEN comes from env.
const config = new pulumi.Config();
const region = config.require("region");
const nodeSize = config.require("nodeSize");
const nodeCount = config.requireNumber("nodeCount");
const domain = config.require("domain");
const acmeEmail = config.require("acmeEmail");
const image = config.require("image");
const appVersion = config.get("appVersion") ?? "dev";

// 2. Provision the cluster (DOKS). Kubernetes version is resolved at deploy
// time from DigitalOcean's latest available release so nothing is hardcoded.
const kubeVersion = digitalocean.getKubernetesVersionsOutput({}).latestVersion;

const cluster = new digitalocean.KubernetesCluster("stoix-doks", {
  region,
  version: kubeVersion,
  nodePool: {
    name: "default",
    size: nodeSize,
    nodeCount,
  },
});

// 3. Build a k8s provider from the cluster's raw kubeconfig.
const kubeProvider = new k8s.Provider("do-k8s", {
  kubeconfig: cluster.kubeConfigs[0].rawConfig,
});

// 4. Install shared cluster prerequisites (ingress-nginx + cert-manager + issuer).
const clusterServices = new ClusterServices("do", { kubeProvider, acmeEmail });

// 5. Deploy the shared app onto the cluster.
const app = new AppDeployment(
  "do",
  {
    image,
    cloud: "digitalocean",
    region,
    appVersion,
    domain,
    kubeProvider,
  },
  { dependsOn: clusterServices },
);

// 6. Exports.
export const kubeconfig = pulumi.secret(cluster.kubeConfigs[0].rawConfig);
export const url = app.url;
