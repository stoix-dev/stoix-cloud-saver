// COST GATE: only run `pulumi up` on this stack AFTER confirming the OKE control
// plane is BASIC_CLUSTER (free) and the A1 node pool fits the tenancy Always Free
// allowance (max 4 OCPU / 24 GB total across all A1 nodes). The Pulumi.dev.yaml
// sizing (1 node x 2 OCPU x 12 GB) stays inside that budget; verify current
// tenancy usage before deploying so nothing spills into paid capacity.
//
// This is the module that hosts tomorrow's live free demo.

import * as oci from "@pulumi/oci";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { AppDeployment, ClusterServices } from "@stoix/infra-shared";

// Thin OCI module. Structure is identical across every cloud module:
// (read config) -> (provision cluster) -> (k8s provider) -> (ClusterServices)
// -> (AppDeployment) -> (exports). That parallel shape is the portability story.
// The only extra weight here is the minimal VCN OKE requires to exist.

// 1. Read config. Only non-secret values; OCI creds come from env / ~/.oci/config.
const config = new pulumi.Config();
const region = config.require("region");
const compartmentId = config.require("compartmentId");
const nodeShape = config.require("nodeShape");
const nodeOcpus = config.requireNumber("nodeOcpus");
const nodeMemoryGbs = config.requireNumber("nodeMemoryGbs");
const nodeCount = config.requireNumber("nodeCount");
const nodeImageId = config.require("nodeImageId");
// ARM A1 free capacity is often exhausted in the first AD; make the index
// selectable so a live deploy can retry another AD without a code change.
const availabilityDomainIndex = config.getNumber("availabilityDomainIndex") ?? 0;
const domain = config.require("domain");
const acmeEmail = config.require("acmeEmail");
const image = config.require("image");
const appVersion = config.get("appVersion") ?? "dev";
// OKE requires an explicit control-plane version. Set a currently supported
// value at deploy time (see `oci ce cluster-options get` for the live list).
const kubernetesVersion = config.get("kubernetesVersion") ?? "v1.30.1";

// 2a. Minimal network OKE needs: a VCN with internet egress and one public
// subnet shared by the API endpoint and the worker nodes. A production setup
// would split endpoint / node / load-balancer subnets and add security lists;
// kept deliberately small here for the showcase.
const availabilityDomain = oci.identity
  .getAvailabilityDomainsOutput({ compartmentId })
  .availabilityDomains.apply((ads) => {
    const ad = ads[availabilityDomainIndex];
    if (ad === undefined) {
      throw new Error(
        `availabilityDomainIndex ${availabilityDomainIndex} is out of range; compartment has ${ads.length} availability domain(s).`,
      );
    }
    return ad.name;
  });

const vcn = new oci.core.Vcn("stoix-oke-vcn", {
  compartmentId,
  cidrBlocks: ["10.0.0.0/16"],
  displayName: "stoix-oke-vcn",
});

const internetGateway = new oci.core.InternetGateway("stoix-oke-igw", {
  compartmentId,
  vcnId: vcn.id,
  enabled: true,
});

const routeTable = new oci.core.RouteTable("stoix-oke-rt", {
  compartmentId,
  vcnId: vcn.id,
  routeRules: [
    {
      networkEntityId: internetGateway.id,
      destination: "0.0.0.0/0",
      destinationType: "CIDR_BLOCK",
    },
  ],
});

const subnet = new oci.core.Subnet("stoix-oke-subnet", {
  compartmentId,
  vcnId: vcn.id,
  cidrBlock: "10.0.0.0/24",
  routeTableId: routeTable.id,
  displayName: "stoix-oke-subnet",
});

// 2b. Provision the cluster (OKE, BASIC_CLUSTER = free control plane) plus an
// Always Free A1 (Ampere Arm) node pool.
const cluster = new oci.containerengine.Cluster("stoix-oke", {
  compartmentId,
  kubernetesVersion,
  vcnId: vcn.id,
  type: "BASIC_CLUSTER",
  endpointConfig: {
    subnetId: subnet.id,
    isPublicIpEnabled: true,
  },
});

new oci.containerengine.NodePool("stoix-oke-nodes", {
  clusterId: cluster.id,
  compartmentId,
  kubernetesVersion,
  nodeShape,
  // A1 flex sizing per node. Total across the pool must stay within Always Free
  // (4 OCPU / 24 GB). Defaults: 1 node x 2 OCPU x 12 GB.
  nodeShapeConfig: {
    ocpus: nodeOcpus,
    memoryInGbs: nodeMemoryGbs,
  },
  nodeSourceDetails: {
    sourceType: "IMAGE",
    imageId: nodeImageId,
  },
  nodeConfigDetails: {
    size: nodeCount,
    placementConfigs: [
      {
        availabilityDomain,
        subnetId: subnet.id,
      },
    ],
  },
});

// 3. Build a k8s provider from the OKE kubeconfig (rendered by the data source).
const kubeconfigContent = oci.containerengine
  .getClusterKubeConfigOutput({ clusterId: cluster.id })
  .content;

const kubeProvider = new k8s.Provider("oci-k8s", {
  kubeconfig: kubeconfigContent,
});

// 4. Install shared cluster prerequisites (ingress-nginx + cert-manager + issuer).
const clusterServices = new ClusterServices("oci", { kubeProvider, acmeEmail });

// 5. Deploy the shared app onto the cluster.
const app = new AppDeployment(
  "oci",
  {
    image,
    cloud: "oci",
    region,
    appVersion,
    domain,
    kubeProvider,
  },
  { dependsOn: clusterServices },
);

// 6. Exports.
export const kubeconfig = pulumi.secret(kubeconfigContent);
export const url = app.url;
