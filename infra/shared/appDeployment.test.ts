import * as pulumi from "@pulumi/pulumi";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Capture the fully resolved inputs of the Deployment as soon as the Pulumi
 * runtime registers it. Mocks receive inputs with every Output/Promise already
 * resolved, so this is the reliable point to inspect env vars and probes.
 * We expose it as a promise so the test can await the exact moment it fires,
 * rather than racing the component's other outputs.
 */
let resolveDeploymentInputs: (inputs: Record<string, any>) => void;
const deploymentInputs = new Promise<Record<string, any>>((resolve) => {
  resolveDeploymentInputs = resolve;
});

pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): { id: string; state: Record<string, any> } => {
    if (args.type === "kubernetes:apps/v1:Deployment") {
      resolveDeploymentInputs(args.inputs);
    }
    return { id: `${args.name}-id`, state: args.inputs };
  },
  call: (args: pulumi.runtime.MockCallArgs): Record<string, any> => args.inputs,
});

/**
 * Resolve a Pulumi Output to a plain value for assertions.
 */
function promiseOf<T>(output: pulumi.Output<T>): Promise<T> {
  return new Promise<T>((resolve) => output.apply(resolve));
}

describe("AppDeployment", () => {
  // Import lazily so setMocks is installed before the component (and the
  // k8s SDK it pulls in) touches the Pulumi runtime.
  let AppDeployment: typeof import("./appDeployment").AppDeployment;
  let k8s: typeof import("@pulumi/kubernetes");
  let component: import("./appDeployment").AppDeployment;

  beforeAll(async () => {
    AppDeployment = (await import("./appDeployment")).AppDeployment;
    k8s = await import("@pulumi/kubernetes");

    const provider = new k8s.Provider("fake-provider", {});
    component = new AppDeployment("test", {
      image: "registry.example/app:1.0.0",
      cloud: "oci",
      region: "us-ashburn-1",
      appVersion: "1.0.0",
      domain: "demo.example.com",
      kubeProvider: provider,
    });
  });

  it("sets CLOUD_PROVIDER and CLOUD_REGION env vars on the container", async () => {
    const inputs = await deploymentInputs;
    const container = inputs.spec.template.spec.containers[0];
    expect(container.env).toContainEqual({ name: "CLOUD_PROVIDER", value: "oci" });
    expect(container.env).toContainEqual({ name: "CLOUD_REGION", value: "us-ashburn-1" });
    expect(container.env).toContainEqual({ name: "APP_VERSION", value: "1.0.0" });
  });

  it("does not set GIT_COMMIT when gitCommit is omitted", async () => {
    const inputs = await deploymentInputs;
    const container = inputs.spec.template.spec.containers[0];
    const names = (container.env as Array<{ name: string }>).map((e) => e.name);
    expect(names).not.toContain("GIT_COMMIT");
  });

  it("exposes readiness and liveness probes hitting /healthz on 8080", async () => {
    const inputs = await deploymentInputs;
    const container = inputs.spec.template.spec.containers[0];
    expect(container.readinessProbe.httpGet.path).toBe("/healthz");
    expect(container.readinessProbe.httpGet.port).toBe(8080);
    expect(container.livenessProbe.httpGet.path).toBe("/healthz");
    expect(container.livenessProbe.httpGet.port).toBe(8080);
    expect(container.ports[0].containerPort).toBe(8080);
  });

  it("resolves url to https://<domain>", async () => {
    const url = await promiseOf(component.url);
    expect(url).toBe("https://demo.example.com");
  });
});
