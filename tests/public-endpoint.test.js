'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
function load(env = {}) {
  const sandbox = { require, module: { exports: {} }, process: { env, platform: process.platform }, console, Buffer, URL, URLSearchParams, setInterval, clearInterval, setTimeout, clearTimeout, __dirname: require('node:path').resolve(__dirname, '..') };
  vm.runInNewContext(source + '\nmodule.exports.testing = { LinkGenerator, bkOnEdgeHost, bkPlatformName, bkIsPlatformHost, bkPublicEndpoint };', sandbox);
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

test('generic public URLs define host, TLS and external port without platform metadata', () => {
  for (const [url, host, port, tls] of [
    ['https://proxy.example.com', 'proxy.example.com', 443, true],
    ['https://proxy.example.com:8443', 'proxy.example.com', 8443, true],
    ['http://proxy.example.com', 'proxy.example.com', 80, false],
    ['http://proxy.example.com:9000', 'proxy.example.com', 9000, false]
  ]) {
    const gen = generator({ PUBLIC_URL: url, PORT: '8080' }, 'internal.example');
    assert.equal(gen.host, host);
    assert.equal(gen.port, port);
    assert.equal(gen.edgeTls, tls);
    assert.equal(gen.publicOrigin, url);
    assert.equal(gen.config.publicPort, 8080);
    if (tls) {
      const uri = new URL(gen.generateVlessWsTls().uri);
      assert.equal(uri.searchParams.get('sni'), host);
      assert.equal(uri.searchParams.has('pcs'), false);
    }
  }
});
test('PUBLIC_TLS and existing LINK_TLS select port 443 on generic hosts', () => {
  for (const key of ['PUBLIC_TLS', 'LINK_TLS']) {
    const gen = generator({ [key]: 'true', PORT: '8080' }, 'proxy.example.com');
    assert.equal(gen.port, 443);
    assert.equal(gen.edgeTls, true);
  }
  const gen = generator({ PUBLIC_URL: 'https://proxy.example.com', PUBLIC_PORT: '9443', LINK_PORT: '8443' });
  assert.equal(gen.port, 8443);
});
test('forwarded scheme and port require explicit proxy trust', () => {
  const request = { headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'proxy.example.com:8443' } };
  for (const trusted of [false, true]) {
    const app = load(trusted ? { TRUST_PROXY: 'true' } : {});
    const gen = new app.testing.LinkGenerator(app.BK_CONFIG, {}, 'proxy.example.com', request);
    assert.equal(gen.edgeTls, trusted);
    assert.equal(gen.port, trusted ? 8443 : 8080);
  }
  const app = load({ TRUST_PROXY: 'true' });
  request.headers['x-forwarded-port'] = '9443';
  assert.equal(new app.testing.LinkGenerator(app.BK_CONFIG, {}, 'proxy.example.com', request).port, 9443);
  const explicit = load({ TRUST_PROXY: 'true', PUBLIC_URL: 'https://fixed.example.com' });
  const fixed = new explicit.testing.LinkGenerator(explicit.BK_CONFIG, {}, 'other.example.com', request);
  assert.equal(fixed.host, 'fixed.example.com');
  assert.equal(fixed.port, 443);
});
test('HTTP proxies, base URL aliases and IPv6 endpoint origins', () => {
  const app = load({ TRUST_PROXY: 'true' });
  const gen = new app.testing.LinkGenerator(app.BK_CONFIG, {}, 'proxy.example.com', { headers: { 'x-forwarded-proto': 'http' } });
  assert.equal(gen.port, 80);
  assert.equal(gen.edgeTls, false);
  assert.equal(generator({ PUBLIC_BASE_URL: 'https://proxy.example.com:8443/knight' }).port, 8443);
  assert.equal(generator({ PUBLIC_URL: 'https://[2001:db8::1]:8443' }).publicOrigin, 'https://[2001:db8::1]:8443');
});
test('invalid endpoint configuration fails clearly', () => {
  for (const env of [
    { PUBLIC_URL: 'not-a-url' }, { PUBLIC_URL: 'ftp://proxy.example.com' },
    { PUBLIC_URL: 'https://user:password@proxy.example.com' },
    { PUBLIC_URL: 'https://proxy.example.com/path' },
    { PUBLIC_PORT: '70000' }, { LINK_PORT: '443oops' }, { PUBLIC_TLS: 'maybe' }
  ]) assert.throws(() => generator(env), /PUBLIC_URL|port|PUBLIC_TLS/);
});

test('Railway custom request domains are not replaced with the generated hostname', () => {
  const gen = generator({ RAILWAY_PUBLIC_DOMAIN: 'generated.up.railway.app' }, 'custom.example.com');
  assert.equal(gen.host, 'custom.example.com');
  assert.equal(gen.port, 443);
  assert.equal(gen.edgeTls, true);
});
