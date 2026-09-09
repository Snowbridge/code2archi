import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isJaxRsResource } from "../../../../src/scan/extract/rest/jaxrs-mapping.js";

describe("isJaxRsResource", () => {
  it("returns false for types with @RegisterRestClient", () => {
    const eligible = isJaxRsResource({
      simpleName: "OrderClient",
      fqcn: "com.example.client.OrderClient",
      annotations: [{ name: "RegisterRestClient", attributes: { configKey: "orders" } }],
      implementedInterfaces: [],
      methods: [
        {
          name: "getOrder",
          annotations: [
            { name: "GET", attributes: {} },
            { name: "Path", attributes: { value: "/{id}" } },
          ],
          parameterTypes: ["String"],
          returnType: "OrderDto",
        },
      ],
    });

    assert.equal(eligible, false);
  });
});
