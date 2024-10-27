import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import * as k8shelm from "@pulumi/kubernetes/helm/v3";
import * as k8s from "@pulumi/kubernetes";
const config = new pulumi.Config()
const clusterName = config.require("clusterName")
const clusterNode = config.require("clusterNode")
const databaseName = config.require("databaseName")

const provider = new digitalocean.Provider("do-provider", {
    token: process.env.DIGITALOCEAN_TOKEN,
});

//  echo $HOME/.kube/config  for Linux/Mac
const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: process.env.KUBECONFIG_PATH,
});

const cluster = new digitalocean.KubernetesCluster(clusterName, {
    region: digitalocean.Region.SFO3,
    version: "1.31.1-do.3",
    nodePool: {
        name: clusterNode,
        size: "s-2vcpu-4gb",
        nodeCount: 1,
    },
});


const postgressDb = new digitalocean.DatabaseCluster(`${databaseName}`, {
    engine: "pg",
    version: "16",
    region: digitalocean.Region.SFO3,
    size: "db-s-1vcpu-1gb",
    nodeCount: 1,
});