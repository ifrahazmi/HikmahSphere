# HikmahSphere Frontend

React SPA for [HikmahSphere](https://hikmahsphere.site).

For install steps, how to use the site, Docker, and API overview, see the **[root README](../README.md)**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Dev server at http://localhost:3000 (proxies `/api` → backend `:5000`) |
| `npm run build` | Production build + prerender |
| `npm test` | Jest |

Full stack from repo root:

```bash
npm run install-deps
cp ../.env.example ../.env   # if not already configured
npm run dev                  # from repo root
```

## License

MIT — see [LICENSE](../LICENSE).
