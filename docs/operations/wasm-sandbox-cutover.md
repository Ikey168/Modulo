# WASM sandbox cutover

`action.code.execute` now runs only in QuickJS-on-WASM. The Rhino implementation,
Maven dependency, and `rhino` configuration value have been removed. The default
in `application.yml`, development compose, Kubernetes configuration, and the
Raspberry Pi compose path is `wasm`; an unknown value fails startup.

The user-visible semantics changes are documented in
`docs/blueprint/wasm-sandbox-drift.md`. In particular, QuickJS follows modern
ECMAScript behavior such as `parseInt('08') === 8`, supports ES2020 syntax that
Rhino could not parse, and enforces the WASM sandbox's hard memory limit in
addition to the wall-clock execution budget.

Local release-gate verification:

```sh
cd backend
mvn -Dtest=ScriptSandboxConfigTest,ScriptSandboxContractTest,BlueprintInterpreterServiceTest test
grep -R "rhino" src/main/java pom.xml
```

The grep should find no runtime Rhino implementation or dependency. The Pi path
uses the same pure-Java QuickJS/WASM stack and requires no JNI/native package.

Two acceptance checks are operational rather than reproducible from a source
checkout: a staging deployment must carry real `action.code.execute` traffic for
one release cycle without sandbox-attributed regressions, and the Pi/minimal
deployment must be exercised on actual arm64 hardware. Those checks must be
recorded from their real environments; local tests must not be represented as a
staging soak or hardware run.
