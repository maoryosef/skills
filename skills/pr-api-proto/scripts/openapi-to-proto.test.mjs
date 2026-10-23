import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = new URL("./openapi-to-proto.mjs", import.meta.url).pathname;
const json = (schema) => ({ content: { "application/json": { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const item = (extra = {}) => ({
  type: "object",
  required: ["id", "status", "note"],
  properties: {
    id: { type: "string", description: "Item id. Stable." },
    status: { type: "string", enum: ["open", "done", "+"] },
    note: { anyOf: [{ type: "string" }, { type: "null" }] },
    tags: { type: "array", items: { type: "string" } },
    ...extra,
  },
});

const spec = (paths, schemas) => ({ openapi: "3.1.0", paths, components: { schemas } });
const getItem = { get: { operationId: "items.get", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: json(ref("Item")), 404: {} } } };
const ping = { get: { operationId: "stable.pong", responses: { 200: json(ref("Pong")) } } };

const base = spec(
  { "/items/{id}": getItem, "/ping": ping, "/old": { get: { operationId: "old.list", responses: { 200: json(ref("Pong")) } } } },
  { Item: item(), Pong: { type: "object", properties: { ok: { type: "boolean" } } } },
);
const head = spec(
  { "/items/{id}": getItem, "/ping": ping, "/items": { post: { operationId: "items.create", requestBody: json(ref("NewItem")), responses: { 201: json(ref("Item")), 400: {} } } } },
  {
    Item: item({ created_at: { type: "string" } }),
    Pong: { type: "object", properties: { ok: { type: "boolean" } } },
    NewItem: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
  },
);

function run(...specs) {
  const dir = mkdtempSync(join(tmpdir(), "proto-"));
  const files = specs.map((s, i) => { const f = join(dir, `${i}.json`); writeFileSync(f, JSON.stringify(s)); return f; });
  return execFileSync("node", [script, ...files, "--package", "demo.v1"], { encoding: "utf8" });
}

test("keeps only operations the PR adds or changes, and lists removed ones", () => {
  const out = run(head, base);
  assert.match(out, /package demo\.v1;/);
  assert.match(out, /\/\/ added: POST \/items {2}errors: 400\n {2}rpc Create\(ItemsCreateRequest\) returns \(Item\);/);
  assert.match(out, /\/\/ changed: GET \/items\/\{id\} {2}errors: 404\n {2}rpc Get\(ItemsGetRequest\) returns \(Item\);/);
  assert.doesNotMatch(out, /rpc Pong/);
  assert.match(out, /\/\/ removed: GET \/old/);
  assert.match(out, /NewItem body = 1;/);
});

test("maps schema shapes to proto3", () => {
  const out = run(head);
  assert.match(out, /rpc Pong\(StablePongRequest\) returns \(demo\.v1\.Pong\);/);
  assert.match(out, /string id = 1; \/\/ Item id\./);
  assert.match(out, /STATUS_UNSPECIFIED = 0;\n\s+STATUS_OPEN = 1;\n\s+STATUS_DONE = 2;\n\s+STATUS_VALUE_3 = 3; \/\/ "\+"/);
  assert.match(out, /optional string note = 3; \/\/ \(null allowed\)/);
  assert.match(out, /repeated string tags = 4;/);
  assert.match(out, /optional google\.protobuf\.Timestamp created_at = 5;/);
});
