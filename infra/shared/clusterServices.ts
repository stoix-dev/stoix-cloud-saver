import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * Inputs for the cluster-level prerequisites the app Ingress depends on. These
 * are the pieces every cloud module would otherwise copy-paste, so they live
 * here once and stay 100% cloud-agnostic: no AWS/DO/OCI logic belongs in this
 * component. Each cloud module just hands over a provider and an ACME email.
 */
export interface ClusterServicesArgs {
  /** Provider bound to the freshly provisioned cluster. */
  kubeProvider: k8s.Provider;
  /** Contact address used for the Let's Encrypt ACME account registration. */
  acmeEmail: string;
}

const INGRESS_NGINX_NAMESPACE = "ingress-nginx";
const CERT_MANAGER_NAMESPACE = "cert-manager";
const CLUSTER_ISSUER_NAME = "letsencrypt";
const INGRESS_CLASS = "nginx";

/**
 * ClusterServices installs the shared cluster prerequisites the showcase app
 * Ingress needs: ingress-nginx (LoadBalancer), cert-manager (with its CRDs),
 * and a production Let's Encrypt ClusterIssuer that solves http01 challenges
 * through the nginx ingress class. Installed once here and reused by every
 * cloud module so the modules stay thin and structurally identical.
 */
export class ClusterServices extends pulumi.ComponentResource {
  constructor(name: string, args: ClusterServicesArgs, opts?: pulumi.ComponentResourceOptions) {
    super("stoix:app:ClusterServices", name, {}, opts);

    const childOpts: pulumi.ComponentResourceOptions = {
      parent: this,
      provider: args.kubeProvider,
    };

    // ingress-nginx: fronts the cluster with a cloud LoadBalancer so the app
    // Ingress (class "nginx") gets a public entrypoint on every provider.
    const ingressNginx = new k8s.helm.v3.Chart(
      `${name}-ingress-nginx`,
      {
        chart: "ingress-nginx",
        namespace: INGRESS_NGINX_NAMESPACE,
        fetchOpts: { repo: "https://kubernetes.github.io/ingress-nginx" },
        values: {
          controller: {
            service: { type: "LoadBalancer" },
            ingressClassResource: { default: true },
          },
        },
      },
      childOpts,
    );

    // cert-manager: issues and renews the TLS certificate the Ingress requests.
    // installCRDs makes the ClusterIssuer/Certificate CRDs available in-cluster.
    const certManager = new k8s.helm.v3.Chart(
      `${name}-cert-manager`,
      {
        chart: "cert-manager",
        namespace: CERT_MANAGER_NAMESPACE,
        fetchOpts: { repo: "https://charts.jetstack.io" },
        values: {
          installCRDs: true,
        },
      },
      childOpts,
    );

    // letsencrypt ClusterIssuer: ACME production endpoint, http01 solved via
    // the nginx ingress class. Depends on cert-manager so its CRD exists first.
    new k8s.apiextensions.CustomResource(
      `${name}-letsencrypt-issuer`,
      {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: { name: CLUSTER_ISSUER_NAME },
        spec: {
          acme: {
            server: "https://acme-v02.api.letsencrypt.org/directory",
            email: args.acmeEmail,
            privateKeySecretRef: { name: `${CLUSTER_ISSUER_NAME}-account-key` },
            solvers: [
              {
                http01: {
                  ingress: { class: INGRESS_CLASS },
                },
              },
            ],
          },
        },
      },
      { ...childOpts, dependsOn: certManager },
    );

    this.registerOutputs({});

    // Reference ingressNginx so the LoadBalancer install is part of this
    // component's resource graph even though it exposes no direct output.
    void ingressNginx;
  }
}
