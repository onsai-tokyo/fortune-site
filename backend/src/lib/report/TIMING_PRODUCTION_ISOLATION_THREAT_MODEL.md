# Timing V2 production isolation threat model

## Purpose

This boundary prevents an unfinished Timing V2 implementation from being connected to the production report graph by an ordinary import, re-export, dynamic import, CommonJS `require`, `createRequire`, barrel, alias, or common reflective access during development.

It is a CI architecture guard for trusted repository code. It is not a JavaScript sandbox and does not claim to contain an adversarial committer who can execute arbitrary code inside the backend process.

## In scope

- Traverse every configured production entrypoint and its local dependency graph.
- Reject direct or transitive dependencies on the registered experimental Timing V2 modules.
- Detect ordinary static and computed module-loading constructs used accidentally during implementation.
- Restrict the one intentional `astronomy-engine` runtime loader to a canonical adapter path and exact SHA-256 content.
- Keep production mode deployment-controlled and fail closed unless readiness and manifest checks pass.

## Out of scope

- Obfuscated property names assembled at runtime.
- Base64, character-code, property enumeration, prototype manipulation, native addons, or equivalent arbitrary-code techniques.
- A malicious contributor intentionally modifying both production code and its tests.
- Runtime isolation of the whole Node.js backend.

Those threats require process/container isolation, code review, protected branches and deployment controls. Deleting or freezing `process` is not used here: it does not revoke an already imported `node:module` capability and can destabilize unrelated backend code.

## Acceptance rule

P0 isolation is acceptable when:

1. the current production dependency graph cannot reach any registered experimental Timing V2 module;
2. ordinary accidental connection paths are covered by regression tests;
3. the astronomy adapter matches its approved canonical path and exact hash;
4. production composition uses deployment environment values only;
5. readiness and manifest validation fail closed; and
6. Timing V2 remains disconnected until a separately approved cutover.

Passing P0 does not authorize threshold calibration or production cutover.
