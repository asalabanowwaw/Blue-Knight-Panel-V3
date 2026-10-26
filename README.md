# Blue Knight Gate: 

A VLESS / VMess / Trojan / Shadowsocks / XHTTP panel that runs on **Free Hosts** (Pterodactyl) using the **one port** your server is given.

## Follow Blue Knight
- ًں“¢ Telegram: [@BlueKnight_Net](https://t.me/BlueKnight_Net)
- â–¶ï¸ڈ YouTube: [@BlueKnight-Net](https://www.youtube.com/@BlueKnight-Net)


## Setup on Free Hosts
1. Create a **Node.js** server (Node 18 or newer, 20 recommended).
2. In **File Manager**, upload `index.js`, `package.json`, `package-lock.json` and the `assets/` folder. Don't upload `node_modules`; it installs itself.
3. Startup file: `index.js` (the start command is `node index.js`).
4. Start the server. The panel reads your port from `SERVER_PORT` automatically; you don't need to set it.
5. On first start, the panel downloads **sing-box** and **Xray-core** from GitHub, so give it a minute.
6. Open `http://<server-ip>:<port>/knight` and create your panel password.
7. Copy the configs or the subscription link into your client.

**Keep the `bk-data/` folder.** It holds your password, UUID and the TLS certificate. If you delete it, every config and TLS pin changes and you'll have to re-import everything.

## Configs (all on the same single port)
| Config | Works in |
|---|---|
| VLESS-WS / VLESS-WS-TLS | all clients |
| VMess-WS / VMess-WS-TLS | all clients |
| Trojan-WS / Trojan-WS-TLS | all clients (Clash: use only Trojan-WS-TLS) |
| VLESS / VMess / Trojan HTTPUpgrade | Xray, sing-box (Clash: VLESS and VMess only) |
| VLESS-gRPC / VLESS-gRPC-TLS | Xray, sing-box, Clash Meta |
| Shadowsocks-WS | Xray, sing-box, Clash Meta (v2ray-plugin websocket) |
| VLESS-XHTTP | **Xray clients only** (v2rayN, v2rayNG, Hiddify with the Xray core) |

Every config is named `ًں’‍t.me/BlueKnight_Net - <type>` and is included in:
- the normal base64 subscription
- the "full" subscription
- the Clash file
- the sing-box file

## TLS notes
- TLS configs use a self-signed certificate.
- Links carry `allowInsecure=1` for older clients and `pcs=<sha256>` (a certificate pin) for Xray 26.2+.
- The certificate renews itself before it expires. When that happens, re-import the subscription.

## Settings (Startup â†’ Variables, or `.env`)
All are optional.

| Variable | Default | Meaning |
|---|---|---|
| `UUID` | random, saved in `bk-data` | Fixed UUID for all configs |
| `PANEL_PASSWORD` | â€“ | Fixed panel password (8+ characters) |
| `SUB_TOKEN` | random | Fixed subscription token |
| `SETUP_KEY` | â€“ | Extra key required the first time you create the password |
| `DOMAIN` | server IP | Domain or host used in links |
| `ENABLE_TROJAN_WS_TLS` | `true` | Trojan-WS-TLS |
| `ENABLE_VMESS_HTTPUPGRADE` / `ENABLE_TROJAN_HTTPUPGRADE` | `true` | HTTPUpgrade configs |
| `ENABLE_VLESS_GRPC` / `ENABLE_VLESS_GRPC_TLS` | `true` | gRPC configs |
| `ENABLE_SS_WS` | `true` | Shadowsocks-WS |
| `ENABLE_XHTTP` | `true` | VLESS-XHTTP |
| `SS_METHOD` / `SS_PASSWORD` | `aes-256-gcm` / random | Shadowsocks cipher and password. For 2022 ciphers, `SS_PASSWORD` must be a base64 key. |
| `LINK_ALLOW_INSECURE` | `true` | `false` removes `allowInsecure=1` from links |

Turn a config off by setting its variable to `false`, then restart the server.

## Troubleshooting
- **XHTTP or Shadowsocks links are missing:** Xray failed to download. Check the console, then restart.
- **TLS config won't connect in a new Xray app:** re-import the subscription so the link has the current `pcs=` pin.
- **Configs changed after a restart:** `bk-data/` was deleted or reset. Set `UUID`, `PANEL_PASSWORD` and `SUB_TOKEN` as variables so they stay the same.
- **Testing:** use **Real delay** or the URL test, not TCP ping.
- **Keep the subscription URL private.** It contains your token.

---
Made by **Blue Knight** آ· [Telegram](https://t.me/BlueKnight_Net) آ· [YouTube](https://www.youtube.com/@BlueKnight-Net)


## Clever Cloud deployment

Clever Cloud terminates HTTPS at its public edge on **443** and forwards HTTP to the app's internal **8080** listener. The app now detects Clever Cloud's injected metadata, or a `*.cleverapps.io` link hostname, and generates TLS links on 443. It omits the backend self-signed certificate pin and enables normal public certificate verification. The internal listener remains on `PORT` (8080 by default).

1. Deploy this repository as a Node.js app with `npm start`.
2. Set `DOMAIN` to your public hostname without a scheme, path or port. Keep `UUID`, `PANEL_PASSWORD` and `SUB_TOKEN` fixed in environment variables to preserve credentials across redeployments.
3. Remove old `LINK_PORT=8080` or `LINK_TLS=false` overrides. You can explicitly set `LINK_PORT=443` and `LINK_TLS=true` for a custom edge frontend.
4. Redeploy, then refresh the subscription or delete and re-import old configs. Previously exported links do not update automatically.
5. Test the WS-TLS nodes first using your client's URL/real-delay test. Plain WS and direct gRPC nodes are omitted on detected HTTP edge hosts. HTTPUpgrade and XHTTP depend on the frontend forwarding those transports; use WS-TLS as the baseline.

If the public domain returns HTTP 451 with "This application has been deactivated", resolve the application status with Clever Cloud support. Changing proxy settings cannot restore a deactivated app.

References: [Clever Cloud request routing](https://www.clever.cloud/developers/doc/find-help/faq/) and [injected environment variables](https://www.clever.cloud/developers/doc/develop/common-configuration/environment-variables/reference/).

Run regression tests with `npm test`.


## Deploy behind any HTTP/TLS frontend

The listening port and the public client endpoint are independent. For any host, container platform, CDN, or reverse proxy that supports WebSocket forwarding, set:

```dotenv
PORT=8080
PUBLIC_URL=https://proxy.example.com
```

`PORT` is where Node listens internally. `PUBLIC_URL` is the externally reachable origin; it sets the client hostname, TLS mode, and external port. Use `https://proxy.example.com:8443` for a nonstandard public TLS port, or `http://proxy.example.com:9000` for a plain HTTP frontend. Do not include a path, query, credentials or fragment in `PUBLIC_URL`. TLS is terminated by the frontend, which forwards plain HTTP/WebSocket traffic to Node.

For direct VPS hosting, leave `PUBLIC_URL` unset and use `DOMAIN` plus `PORT`; existing direct TLS links continue to use the backend certificate.

| Setting | Meaning |
|---|---|
| `PUBLIC_URL` | Public origin, independent of hosting provider; recommended behind a proxy |
| `PUBLIC_PORT` | Override the external client port |
| `PUBLIC_TLS` | `true` for a frontend with a trusted public TLS certificate, `false` for plain HTTP |
| `LINK_PORT` / `LINK_TLS` | Existing aliases; override `PUBLIC_PORT` / `PUBLIC_TLS` |
| `TRUST_PROXY` | Set to `true` to derive scheme and port from `X-Forwarded-Proto`, `X-Forwarded-Port` and the forwarded Host when no public URL is configured |

Endpoint priority: explicit link overrides, explicit public URL (also accepts existing `PUBLIC_BASE_URL` / `SUB_BASE_URL`), trusted request headers, existing platform detection, then the direct listening port. `PUBLIC_URL` supplies the hostname; `FORCE_HOST` can override the connection address while retaining the configured domain for TLS SNI. Set `PUBLIC_URL` on deployments where startup-generated links must also match a reverse proxy; request headers are only available during panel/subscription requests.

Enable `TRUST_PROXY` only when the app is reached through a frontend that overwrites forwarded headers. See [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/). It is optional when using `PUBLIC_URL`.

These settings make endpoint generation portable. The hosting service must still support persistent WebSocket connections and the requested transport; HTTP-only hosts cannot expose raw TCP or UDP protocols through an HTTPS URL. Refresh subscriptions after changing the public endpoint.


### Container exits with `listen EACCES` on port 80 or 443

The process cannot bind that internal port with its current permissions. Run Node on an unprivileged port and route the public frontend to it:

```dotenv
PORT=8080
PUBLIC_URL=https://your-actual-app-domain
```

If the hosting service injects `PORT` and allows you to configure its container target port, use `LISTEN_PORT=8080` and set that target/health-check port to `8080`. If the platform requires a particular `PORT`, follow its routing settings rather than overriding it. Internal bind priority is `LISTEN_PORT`, then `PORT`, `SERVER_PORT`, `SB_PORT`, then the configured/default 8080. `PUBLIC_PORT` only changes client configs.

For Docker, map frontend ports to the internal listener (for example `-p 80:8080` for HTTP); HTTPS requires a TLS frontend. Do not set the Node listener to 80 just because users connect to public port 80. Replace all example hostnames with your real application URL. The npm update notice is informational; the `EACCES` line is the startup failure.
