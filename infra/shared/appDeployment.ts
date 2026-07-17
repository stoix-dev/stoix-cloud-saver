import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * Inputs for the shared app deployment. Everything the component needs to place
 * the same container onto any Kubernetes cluster. Cloud identity (cloud/region)
 * is passed in as data and surfaced to the app purely through env vars, so this
 * component stays 100% cloud-agnostic: no AWS/DO/OCI logic lives here.
 */
export interface AppDeploymentArgs {
  /** Fully qualified container image reference, e.g. "registry/app:1.0.0". */
  image: pulumi.Input<string>;
  /** Cloud identity reported by the app (drives CLOUD_PROVIDER). */
  cloud: string;
  /** Cloud region reported by the app (drives CLOUD_REGION). */
  region: string;
  /** App version reported by the app (drives APP_VERSION). */
  appVersion: pulumi.Input<string>;
  /** Public host the Ingress routes and requests a TLS cert for. */
  domain: string;
  /** Desired replica count. Defaults to 1. */
  replicas?: number;
  /** Provider bound to the target cluster, supplied by each cloud module. */
  kubeProvider: k8s.Provider;
  /** Optional git commit reported by the app (drives GIT_COMMIT). */
  gitCommit?: pulumi.Input<string>;
}

const APP_NAME = "stoix-app";
const NAMESPACE = "stoix-app";
const CONTAINER_PORT = 8080;
const SERVICE_PORT = 80;
const TLS_SECRET_NAME = "stoix-app-tls";

/**
 * AppDeployment provisions the full Kubernetes footprint for the showcase app
 * (Namespace, Deployment, Service, Ingress) against whatever cluster the given
 * provider points at. Written once, reused by every cloud module: that DRY reuse
 * is the entire point of the multi-cloud vitrine.
 */
export class AppDeployment extends pulumi.ComponentResource {
  /** Public HTTPS URL the app is reachable at. */
  public readonly url: pulumi.Output<string>;

  constructor(name: string, args: AppDeploymentArgs, opts?: pulumi.ComponentResourceOptions) {
    super("stoix:app:AppDeployment", name, {}, opts);

    const childOpts: pulumi.CustomResourceOptions = {
      parent: this,
      provider: args.kubeProvider,
    };

    const labels: Record<string, string> = { app: APP_NAME };

    const namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      { metadata: { name: NAMESPACE } },
      childOpts,
    );

    const namespaceName = namespace.metadata.name;

    const env: k8s.types.input.core.v1.EnvVar[] = [
      { name: "CLOUD_PROVIDER", value: args.cloud },
      { name: "CLOUD_REGION", value: args.region },
      { name: "APP_VERSION", value: args.appVersion },
    ];
    if (args.gitCommit !== undefined) {
      env.push({ name: "GIT_COMMIT", value: args.gitCommit });
    }

    const deployment = new k8s.apps.v1.Deployment(
      `${name}-deployment`,
      {
        metadata: { name: APP_NAME, namespace: namespaceName, labels },
        spec: {
          replicas: args.replicas ?? 1,
          selector: { matchLabels: labels },
          template: {
            metadata: { labels },
            spec: {
              containers: [
                {
                  name: APP_NAME,
                  image: args.image,
                  ports: [{ containerPort: CONTAINER_PORT }],
                  env,
                  resources: {
                    requests: { cpu: "50m", memory: "64Mi" },
                    limits: { cpu: "250m", memory: "128Mi" },
                  },
                  readinessProbe: {
                    httpGet: { path: "/healthz", port: CONTAINER_PORT },
                    initialDelaySeconds: 5,
                    periodSeconds: 10,
                  },
                  livenessProbe: {
                    httpGet: { path: "/healthz", port: CONTAINER_PORT },
                    initialDelaySeconds: 10,
                    periodSeconds: 15,
                  },
                },
              ],
            },
          },
        },
      },
      childOpts,
    );

    const service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: { name: APP_NAME, namespace: namespaceName, labels },
        spec: {
          type: "ClusterIP",
          selector: labels,
          ports: [{ port: SERVICE_PORT, targetPort: CONTAINER_PORT, protocol: "TCP" }],
        },
      },
      { ...childOpts, dependsOn: deployment },
    );

    new k8s.networking.v1.Ingress(
      `${name}-ingress`,
      {
        metadata: {
          name: APP_NAME,
          namespace: namespaceName,
          annotations: {
            "kubernetes.io/ingress.class": "nginx",
            "cert-manager.io/cluster-issuer": "letsencrypt",
          },
        },
        spec: {
          tls: [{ hosts: [args.domain], secretName: TLS_SECRET_NAME }],
          rules: [
            {
              host: args.domain,
              http: {
                paths: [
                  {
                    path: "/",
                    pathType: "Prefix",
                    backend: {
                      service: {
                        name: APP_NAME,
                        port: { number: SERVICE_PORT },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      { ...childOpts, dependsOn: service },
    );

    this.url = pulumi.output(`https://${args.domain}`);

    this.registerOutputs({ url: this.url });
  }
}
