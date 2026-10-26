'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
function load(env = {}) {
  const sandbox = { require, module: { exports: {} }, process: { env, platform: process.platform }, console, Buffer, URL, URLSearchParams, setInterval, clearInterval, setTimeout, clearTimeout, __dirname: require('node:path').resolve(__dirname, '..') };
  vm.runInNewContext(source + '\nmodule.exports.testing = { LinkGenerator, bkOnEdgeHost, bkPlatformName, bkIsPlatformHost };', sandbox);
  return sandbox.module.exports;
}
function generator(env, host = 'app-example.cleverapps.io') {
  const app = load(env);
  const config = structuredClone(app.BK_CONFIG);
  return new app.testing.LinkGenerator(config, { uuid: '11111111-1111-4111-8111-111111111111' }, host);
}
test('Clever Cloud metadata detects edge hosting with custom domains', () => {
  for (const key of ['CC_APP_NAME', 'CC_DEPLOYMENT_ID', 'CC_REVERSE_PROXY_IPS', 'CC_PRETTY_INSTANCE_NAME']) {
    const app = load({ [key]: 'test', PORT: '8080' });
    assert.equal(app.testing.bkOnEdgeHost(), true);
    assert.equal(app.testing.bkPlatformName(), 'Clever Cloud');
    const gen = generator({ [key]: 'test', PORT: '8080' }, 'proxy.example.com');
    assert.equal(gen.port, 443);
    assert.equal(gen.edgeTls, true);
  }
});
test('cleverapps hostname uses public TLS even without platform metadata', () => {
  const gen = generator({ PORT: '8080' });
  assert.equal(gen.config.publicPort, 8080);
  assert.equal(gen.port, 443);
  const nodes = gen.getAllNodes({ compat: 'full', allowLocalHostLinks: true });
  assert.ok(nodes.length >= 6);
  for (const node of nodes) {
    if (node.uri.startsWith('vmess://')) {
      const data = JSON.parse(Buffer.from(node.uri.slice(8), 'base64').toString());
      assert.equal(Number(data.port), 443);
      assert.equal(data.tls, 'tls');
      assert.ok(!data.pcs);
      assert.ok(data.insecure === undefined || String(data.insecure) === '0');
    } else {
      const uri = new URL(node.uri);
      assert.equal(uri.port, '443');
      assert.equal(uri.searchParams.get('security'), 'tls');
      assert.equal(uri.searchParams.has('pcs'), false);
      assert.equal(uri.searchParams.has('allowInsecure'), false);
    }
    for (const outbound of node.singboxOutbound || []) {
      assert.equal(outbound.server_port, 443);
      assert.equal(outbound.tls.insecure, false);
    }
    if (node.clash) {
      assert.equal(node.clash.port, 443);
      assert.equal(node.clash['skip-cert-verify'], false);
      assert.ok(!node.clash.fingerprint);
    }
  }
  assert.equal(gen.generateVlessWs(), null);
  assert.equal(gen.generateVlessGrpc(), null);
  assert.equal(load().testing.bkIsPlatformHost('app-example.cleverapps.io'), true);
});
test('self-hosted and existing edge platforms retain their behavior', () => {
  const self = generator({ PORT: '8080' }, 'proxy.example.com');
  assert.equal(self.port, 8080);
  assert.equal(self.edgeTls, false);
  assert.ok(self.generateVlessWs());
  for (const env of [{ RAILWAY_PROJECT_ID: 'test' }, { REPLIT_DEPLOYMENT: '1' }]) {
    const gen = generator(env, 'proxy.example.com');
    assert.equal(gen.port, 443);
    assert.equal(gen.edgeTls, true);
  }
});
test('explicit link overrides remain available for custom frontends', () => {
  const gen = generator({ CC_APP_NAME: 'test', LINK_PORT: '8443', LINK_TLS: 'true' });
  assert.equal(gen.port, 8443);
  assert.equal(gen.edgeTls, true);
  const plain = generator({ CC_APP_NAME: 'test', LINK_PORT: '80', LINK_TLS: 'false' });
  assert.equal(plain.port, 80);
  assert.equal(plain.edgeTls, false);
});
