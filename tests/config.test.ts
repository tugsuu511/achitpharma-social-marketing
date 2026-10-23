import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { validateProductionEnvironment } from "../src/lib/config";

const dataDirectory = path.resolve("test-results", "config-data");
const productionEnvironment = {
  APP_ORIGIN: "https://team.example.com",
  COOKIE_SECURE: "true",
  DATA_DIR: dataDirectory,
  TRUST_PROXY: "true",
  IP_HASH_SECRET: "test-only-ip-hash-secret-at-least-32-characters",
};

test("production environment requires HTTPS, secure cookies, and an absolute data directory", () => {
  assert.throws(() => validateProductionEnvironment({}), /APP_ORIGIN/);
  assert.throws(() => validateProductionEnvironment({ ...productionEnvironment, APP_ORIGIN: "http://team.example.com" }), /HTTPS/);
  assert.throws(() => validateProductionEnvironment({ ...productionEnvironment, COOKIE_SECURE: "false" }), /COOKIE_SECURE/);
  assert.throws(() => validateProductionEnvironment({ ...productionEnvironment, APP_ORIGIN: "https://team.example.com/" }), /without a path or trailing slash/);

  assert.deepEqual(validateProductionEnvironment(productionEnvironment), {
    appOrigin: "https://team.example.com",
    dataDirectory,
    secureCookies: true,
    insecureLocalOrigin: false,
  });
});

test("insecure production origin exception is limited to explicit loopback testing", () => {
  const local = validateProductionEnvironment({ ...productionEnvironment, APP_ORIGIN: "http://127.0.0.1:3199", COOKIE_SECURE: "false", ALLOW_INSECURE_LOCAL_ORIGIN: "true" });
  assert.equal(local.insecureLocalOrigin, true);
  assert.throws(() => validateProductionEnvironment({ ...productionEnvironment, APP_ORIGIN: "http://team.example.com", COOKIE_SECURE: "false", ALLOW_INSECURE_LOCAL_ORIGIN: "true" }), /HTTPS/);
});

test("production environment requires trusted proxy hashing configuration", () => {
  assert.throws(() => validateProductionEnvironment({ ...productionEnvironment, TRUST_PROXY: "false" }), /TRUST_PROXY/);
  assert.throws(() => validateProductionEnvironment({ ...productionEnvironment, IP_HASH_SECRET: "short" }), /IP_HASH_SECRET/);
  assert.throws(() => validateProductionEnvironment({ ...productionEnvironment, PRIVATE_FILES_DIR: "relative/files" }), /PRIVATE_FILES_DIR/);
  assert.throws(() => validateProductionEnvironment({ ...productionEnvironment, DATA_DIR: path.resolve("public","data") }), /public/);
  assert.throws(() => validateProductionEnvironment({ ...productionEnvironment, PRIVATE_FILES_DIR: path.resolve("public","files") }), /public/);
});
