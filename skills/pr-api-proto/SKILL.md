---
name: pr-api-proto
description: >-
  Show the HTTP API that a pull request adds, changes or removes as a protobuf
  (proto3) sketch: services and rpcs, request and response messages, enums and
  nullability, plus a short plain-English summary. Read-only. Use when the user
  asks to "describe the API this PR adds", "show the API as protobuf / proto",
  "sketch the contract", "what endpoints does this PR change", or wants a PR's
  API surface in a compact typed form.
argument-hint: "[pr-number-or-url]"
---

# PR API as protobuf

Show the API surface of a PR as a proto3 file. Proto is only a compact notation
here: the API stays HTTP and JSON. Nobody compiles or serves this file.

**Read-only.** Never post to GitHub, push, check out a branch or edit the repo.
Read the code with `git show <sha>:<path>`. Write files only in your scratchpad.
Do not run the repo's code generators, because they write into the user's tree.

## 1. Resolve the PR

Use the PR from the argument, or the PR of the current branch.

```
gh pr view <n> --json url,baseRefName,headRefOid,files
git fetch origin '+refs/heads/<baseRefName>:refs/remotes/origin/<baseRefName>'
git merge-base origin/<baseRefName> <headRefOid>
```

The merge-base is the "before" side, and `headRefOid` is the "after" side.

## 2. Get the contract on both sides

Look in the PR's files for a generated OpenAPI snapshot, such as
`openapi.json`, `swagger.json` or `openapi.yaml`. Save both sides in the
scratchpad:

```
git show <merge-base>:<path> > <scratchpad>/base.json
git show <headRefOid>:<path> > <scratchpad>/head.json
```

When the PR adds the snapshot, there is no base file. Run the script with
`head.json` only. Convert a YAML snapshot to JSON first, for example with
`npx -y js-yaml <file>.yaml > <file>.json`.

When the repo has no snapshot, read the contract sources at head instead, such
as Effect `HttpApi` groups and endpoints, route handlers with their schemas, or
controllers. Write the proto by hand with the mapping rules below, and skip
step 3.

## 3. Generate the sketch

```
node <this skill's directory>/scripts/openapi-to-proto.mjs head.json base.json --package <pkg> > <scratchpad>/<name>.proto
```

For `<pkg>`, use the repo and package name, for example `accomplish.contracts_web`.

With a base file, the script keeps only the operations the PR adds or changes.
Each rpc gets a comment with `added` or `changed`, the HTTP method, the path and
the error codes. A `// removed:` line lists each operation the PR deletes.
Operations that did not change are left out.

## 4. Fix by hand what the script gets wrong

- **Numbers sent as query strings**: OpenAPI types every query parameter as a
  string. When its description says it is a number, change it to `int64`.
- **Repeated inline objects**: when the same inline object appears in many
  messages, for example `{delta, previous, value}`, move it into one shared
  top-level message. Give it a name from the domain, such as `DecimalFigure`.
- **Enum values the script could not name**: the script writes `VALUE_<n>`
  with the original value in a comment. Give them a name from their meaning.
- **`google.protobuf.Struct`**: this marks a free-form object. Check the source
  to see if it has a known shape.
- **Changed operations**: the script says that an operation changed, but not
  how. Compare that path in `base.json` and `head.json`, and write the change
  in one line, for example "adds the optional `cursor` query parameter".

If `buf` is reachable, check that the file is valid:
`npx -y @bufbuild/buf@1 build` in a scratch directory that holds only the
`.proto` file and a `buf.yaml` file with the line `version: v2`. Fix every
error it reports.

## 5. Report

In this order:

1. **Summary**: 3–5 plain sentences. Say what the PR adds, changes and removes,
   and which group or groups it touches.
2. **Services block**: every `service` with its rpcs and their comments.
3. **Shared messages**: the messages that many responses use.
4. **Typical messages**: 2–3 request and response pairs that show the shape
   best. Do not paste the whole file.
5. **JSON mapping note**: the short table below, so the reader can map the
   proto back to the JSON on the wire.
6. **The full file**: its path in the scratchpad.

## Mapping rules

| JSON schema | Proto |
|---|---|
| object with properties | `message`. An inline object becomes a nested message. |
| array | `repeated` |
| nullable (`anyOf` with `null`) | `optional`, with `(null allowed)` in the comment |
| property not in `required` | `optional` |
| string enum | nested `enum` with `<NAME>_UNSPECIFIED = 0`. On the wire, the value is the string literal. |
| enum with one value | `string`, with `always "<value>"` in the comment |
| union of objects | `oneof`, keyed by the `kind` field of each object |
| integer / number / boolean | `int64` / `double` / `bool` |
| `date-time`, `*_at` field, ISO 8601 string | `google.protobuf.Timestamp`. On the wire, it is an ISO string. |
| free-form object | `google.protobuf.Struct` |
| path and query parameters, request body | fields of `<Group><Op>Request`. A request body is the `body` field. |
| 2xx response | the return type. With no body, `google.protobuf.Empty`. |
| first sentence of a description | trailing comment |
