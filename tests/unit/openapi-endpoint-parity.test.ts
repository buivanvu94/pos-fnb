import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const OPENAPI_FILE = path.join(ROOT, "ba/api/pos-fnb.openapi.yaml");

interface OpenApiOperation {
  routePath: string;
  method: string;
}

/** Reads `"/api/v1/..."` path keys and the HTTP verbs listed under each one in the OpenAPI file. */
function readOperations(): OpenApiOperation[] {
  const lines = fs.readFileSync(OPENAPI_FILE, "utf8").split(/\r?\n/);
  const operations: OpenApiOperation[] = [];
  let currentPath: string | null = null;
  for (const line of lines) {
    const pathMatch = line.match(/^ {2}"(\/api\/v1\/[^"]+)":\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
    if (methodMatch && currentPath) {
      operations.push({ routePath: currentPath, method: methodMatch[1].toUpperCase() });
    }
  }
  return operations;
}

describe("OpenAPI parity - ba/api/pos-fnb.openapi.yaml vs src/app/api/v1 (09-api section 7)", () => {
  const operations = readOperations();

  it("lists the 9 documented endpoints (API-01..API-09)", () => {
    expect(operations).toHaveLength(9);
  });

  it.each(operations)("$method $routePath has a route handler exporting that method", ({ routePath, method }) => {
    const routeFile = path.join(ROOT, "src/app", routePath, "route.ts");
    expect(fs.existsSync(routeFile), `missing route file for ${routePath}`).toBe(true);
    const source = fs.readFileSync(routeFile, "utf8");
    const exported = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\b`);
    expect(exported.test(source), `${routePath} does not export ${method}`).toBe(true);
  });
});
