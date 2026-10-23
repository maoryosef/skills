import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const pkgAt = args.indexOf("--package");
const pkg = pkgAt >= 0 ? args.splice(pkgAt, 2)[1] : "api";
const [head, base] = args.map((f) => JSON.parse(readFileSync(f, "utf8")));
const S = head.components?.schemas ?? {};
const METHODS = ["get", "post", "put", "patch", "delete"];

const pascal = (s) => String(s).replace(/(^|[-_ .{}/])(\w)/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");
const snake = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[-. ]/g, "_").toLowerCase();
const singular = (n) => (n.endsWith("ies") ? n.slice(0, -3) + "y" : n.endsWith("s") && !n.endsWith("ss") ? n.slice(0, -1) : n);
const refName = (r) => r.split("/").pop();
const nonNull = (xs) => xs.filter((x) => x.type !== "null");
const short = (d) => {
  if (!d) return "";
  const first = d.split(/(?<=\.)\s/)[0];
  return first.length > 140 ? first.slice(0, 137) + "..." : first;
};
const resolve = (spec, x) => (x?.$ref ? x.$ref.split("/").slice(1).reduce((o, k) => o?.[k], spec) : x);

function flatten(s) {
  if (!s?.allOf) return s;
  const parts = s.allOf.map((p) => flatten(resolve(head, p)));
  return {
    type: "object",
    description: s.description,
    properties: Object.assign({}, ...parts.map((p) => p.properties)),
    required: parts.flatMap((p) => p.required ?? []),
  };
}

const wanted = new Set();

function scalar(s, name) {
  if (s.type === "integer") return "int64";
  if (s.type === "number") return "double";
  if (s.type === "boolean") return "bool";
  const instant = s.format === "date-time" || /(_at|At)$/.test(name) || /ISO[ -]?8601/i.test(s.description ?? "");
  return instant ? "google.protobuf.Timestamp" : "string";
}

function field(schema, name, nested, indent) {
  let s = flatten(schema);
  let nullable = false;
  const notes = [];
  const alts = s.anyOf || s.oneOf;
  if (alts) {
    const nn = nonNull(alts);
    nullable = nn.length < alts.length;
    if (nn.length === 1) s = { ...flatten(nn[0]), description: s.description || nn[0].description };
    else if (nn.every((x) => x.type === "string")) {
      const vals = nn.flatMap((x) => x.enum || []);
      s = { type: "string", description: s.description };
      if (vals.length) notes.push(`one of: ${vals.join(", ")}`);
    } else return { type: oneofMsg(nn, name, nested, indent), nullable, notes };
  }
  if (Array.isArray(s.type)) {
    const t = s.type.filter((x) => x !== "null");
    nullable ||= t.length < s.type.length;
    s = { ...s, type: t[0] };
  }
  if (s.$ref) {
    const n = refName(s.$ref);
    wanted.add(n);
    return { type: n, nullable, notes };
  }
  if (s.type === "array") {
    const inner = field(s.items ?? {}, singular(name), nested, indent);
    const len = s.minItems !== undefined && s.minItems === s.maxItems ? [`exactly ${s.minItems}`] : [];
    return { type: inner.type, repeated: true, nullable, notes: [...notes, ...len, ...inner.notes] };
  }
  if (s.enum) {
    if (s.enum.length === 1) return { type: "string", nullable, notes: [...notes, `always "${s.enum[0]}"`] };
    const en = pascal(name);
    nested.push(enumDef(en, s.enum, indent));
    return { type: en, nullable, notes };
  }
  if (s.type === "object" && s.properties) {
    const mn = pascal(singular(name));
    nested.push(message(mn, s, indent));
    return { type: mn, nullable, notes };
  }
  if (s.type === "object") return { type: "google.protobuf.Struct", nullable, notes };
  return { type: scalar(s, name), nullable, notes };
}

function enumDef(name, values, indent) {
  const p = " ".repeat(indent);
  const pre = snake(name).toUpperCase();
  const lines = values.map((v, i) => {
    const id = snake(v).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const ok = /[A-Z0-9]/.test(id);
    return `${p}  ${pre}_${ok ? id : `VALUE_${i + 1}`} = ${i + 1};${ok ? "" : ` // "${v}"`}`;
  });
  return [`${p}enum ${name} {`, `${p}  ${pre}_UNSPECIFIED = 0;`, ...lines, `${p}}`].join("\n");
}

function oneofMsg(alts, name, nested, indent) {
  const mn = pascal(name);
  const p = " ".repeat(indent);
  const inner = [];
  const cases = alts.map((a, i) => {
    if (a.$ref) {
      wanted.add(refName(a.$ref));
      return `${p}    ${refName(a.$ref)} ${snake(refName(a.$ref))} = ${i + 1};`;
    }
    const kind = a.properties?.kind?.enum?.[0] ?? `variant${i + 1}`;
    inner.push(message(pascal(kind), flatten(a), indent + 2));
    return `${p}    ${pascal(kind)} ${snake(kind)} = ${i + 1};`;
  });
  nested.push([`${p}message ${mn} {`, ...inner, `${p}  oneof value {`, ...cases, `${p}  }`, `${p}}`].join("\n"));
  return mn;
}

function message(name, s, indent = 0) {
  const p = " ".repeat(indent);
  const req = new Set(s.required || []);
  const nested = [];
  const fields = Object.entries(s.properties || {}).map(([k, v], i) => {
    const f = field(v, k, nested, indent + 2);
    const label = f.repeated ? "repeated " : f.nullable || !req.has(k) ? "optional " : "";
    const notes = [...f.notes, ...(f.nullable ? ["null allowed"] : [])];
    const desc = short(v.description || (v.anyOf || v.oneOf || []).find((x) => x.description)?.description);
    const c = [desc, notes.length ? `(${notes.join("; ")})` : ""].filter(Boolean).join(" ");
    return `${p}  ${label}${f.type} ${snake(k)} = ${i + 1};${c ? " // " + c : ""}`;
  });
  const head = short(s.description);
  return [head && `${p}// ${head}`, `${p}message ${name} {`, ...nested, ...fields, `${p}}`].filter(Boolean).join("\n");
}

function operations(spec) {
  const ops = new Map();
  for (const [path, item] of Object.entries(spec.paths ?? {}))
    for (const m of METHODS) if (item[m]) ops.set(`${m.toUpperCase()} ${path}`, { path, method: m, op: item[m], shared: item.parameters ?? [] });
  return ops;
}

function signature(spec, op) {
  const seen = new Set();
  const walk = (x) => {
    if (!x || typeof x !== "object") return;
    if (typeof x.$ref === "string" && !seen.has(x.$ref)) {
      seen.add(x.$ref);
      walk(resolve(spec, x));
    }
    Object.values(x).forEach(walk);
  };
  walk(op);
  return JSON.stringify([op, [...seen].sort().map((r) => [r, resolve(spec, { $ref: r })])]);
}

const headOps = operations(head);
const baseOps = base ? operations(base) : null;
const picked = [...headOps].flatMap(([key, o]) => {
  if (!baseOps) return [{ ...o, key, status: "" }];
  const before = baseOps.get(key);
  if (!before) return [{ ...o, key, status: "added" }];
  return signature(base, before) === signature(head, o) ? [] : [{ ...o, key, status: "changed" }];
});
const removed = baseOps ? [...baseOps.keys()].filter((k) => !headOps.has(k)) : [];

const services = {};
const extraMsgs = [];
for (const { key, method, op, shared, status } of picked) {
  const id = op.operationId ?? `${method}${pascal(key.split(" ")[1])}`;
  const [group, rpc] = id.includes(".") ? id.split(".") : [op.tags?.[0] ?? "Api", id];
  const reqName = `${pascal(group)}${pascal(rpc)}Request`;
  const nested = [];
  const params = [...shared, ...(op.parameters ?? [])].map((x) => resolve(head, x));
  const lines = params.map((prm, i) => {
    const f = field(prm.schema ?? {}, prm.name, nested, 2);
    const label = f.repeated ? "repeated " : prm.required ? "" : "optional ";
    const d = short(prm.description || prm.schema?.description);
    return `  ${label}${f.type} ${snake(prm.name)} = ${i + 1}; // ${prm.in}${d ? ": " + d : ""}`;
  });
  const body = resolve(head, op.requestBody)?.content?.["application/json"]?.schema;
  if (body) {
    const f = field(body, "body", nested, 2);
    lines.push(`  ${f.repeated ? "repeated " : ""}${f.type} body = ${lines.length + 1}; // request body`);
  }
  extraMsgs.push([`message ${reqName} {`, ...nested, ...lines, "}"].join("\n"));

  const codes = Object.keys(op.responses ?? {});
  const ok = codes.find((c) => c.startsWith("2"));
  const res = ok && resolve(head, op.responses[ok])?.content?.["application/json"]?.schema;
  let resName = "google.protobuf.Empty";
  if (res) {
    const resNested = [];
    const f = field(res, `${pascal(group)}${pascal(rpc)}Response`, resNested, 0);
    resName = f.repeated ? `${pascal(group)}${pascal(rpc)}Response` : f.type;
    if (f.repeated) extraMsgs.push(`message ${resName} {\n  repeated ${f.type} items = 1;\n}`);
    extraMsgs.push(...resNested);
  }
  const errs = codes.filter((c) => !c.startsWith("2")).join(", ");
  const comment = `  // ${status ? status + ": " : ""}${key}${errs ? "  errors: " + errs : ""}`;
  (services[group] ||= []).push({ comment, name: pascal(rpc), reqName, resName });
}

const done = new Set();
const msgs = [];
while ([...wanted].some((w) => !done.has(w))) {
  for (const w of [...wanted]) {
    if (done.has(w)) continue;
    done.add(w);
    const s = flatten(S[w]);
    if (!s) continue;
    if (s.anyOf || s.oneOf) {
      const nested = [];
      oneofMsg(nonNull(s.anyOf || s.oneOf), w, nested, 0);
      msgs.push(nested.join("\n"));
    } else if (s.type === "object") msgs.push(message(w, s));
    else {
      const f = field(s, w, [], 0);
      msgs.push(`// ${w} is a ${f.type}${f.notes.length ? " (" + f.notes.join("; ") + ")" : ""}. ${short(s.description)}`.trim());
    }
  }
}

const out = [
  `syntax = "proto3";\npackage ${pkg};\n\nimport "google/protobuf/empty.proto";\nimport "google/protobuf/struct.proto";\nimport "google/protobuf/timestamp.proto";\n`,
  ...removed.map((k) => `// removed: ${k}`),
  ...Object.entries(services).map(([g, rpcs]) => {
    const names = new Set(rpcs.map((r) => r.name));
    const qualify = (t) => (names.has(t) ? `${pkg}.${t}` : t);
    const body = rpcs.map((r) => `${r.comment}\n  rpc ${r.name}(${qualify(r.reqName)}) returns (${qualify(r.resName)});`);
    return `\nservice ${pascal(g)} {\n${body.join("\n\n")}\n}`;
  }),
  "",
  [...extraMsgs, ...msgs].join("\n\n"),
];
console.log(out.join("\n"));
