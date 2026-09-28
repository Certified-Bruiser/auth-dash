# my-auth-app

React, TypeScript, and Vite frontend for AgentOS. This frontend and the `A-OS` backend are separate repositories. There is no root-level Compose file joining them; run frontend and backend commands from their respective repository directories.

## Docker Environments

| Environment | Dockerfile | Compose file | Port | Source mount / reload | Runtime |
| --- | --- | --- | --- | --- | --- |
| LOCAL | `Dockerfile` | `docker-compose.yaml` | `5173` | Source bind-mounted at `/app`; Vite HMR enabled | Vite dev server |
| DEV | `Dockerfile.dev` | `docker-compose.dev.yaml` | `5173` | No source mount or reload | `vite preview` serving the Vite build |
| PROD | `Dockerfile.prod` | `docker-compose.prod.yaml` | `80` | No source mount or volumes | Nginx serving the Vite build |

DEV and PROD build images from repository contents rather than bind-mounting source. PROD uses a multi-stage Node build followed by Nginx. The `nginx.conf` SPA fallback serves `index.html` for paths that do not match a file.

## Environment Variables

The frontend uses these browser-facing variables:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase URL used by the browser client |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase key used by the browser client |
| `VITE_API_BASE_URL` | Backend HTTP API base URL |

For LOCAL, Vite reads its environment from the frontend project directory; the source bind mount makes that directory available in the container. LOCAL Compose does not interpolate these variables or define a service `env_file`.

DEV and PROD Compose files require the three variables through Compose interpolation and pass them as Docker build arguments. They are **build-time configuration**: Vite embeds them in the generated static assets. They are not runtime Nginx container settings. Set `VITE_API_BASE_URL` to the backend address reachable by the browser. The frontend derives its WebSocket URL by converting `http` to `ws` or `https` to `wss`, then appending `/ws`. If unset in the app, the code falls back to `http://localhost:8000`; DEV and PROD Compose require the variable to avoid that fallback.

Compose interpolation can read values from a supplied `--env-file` or the shell environment. These values are distinct from a service-level `env_file`, which injects variables into a running container.

## Commands

Run these commands from the `my-auth-app` repository directory. The backend is started separately from `A-OS`; see its `SETUP.md`.

### LOCAL

```sh
docker compose build
docker compose up
docker compose down
```

LOCAL publishes port `5173` and uses a source bind mount plus the named `frontend_node_modules` volume at `/app/node_modules`.

### DEV

The `.env` below is the frontend repository's Compose interpolation file. Provide the required `VITE_*` variables there or in the shell environment.

```sh
docker compose --env-file .env -f docker-compose.dev.yaml build
docker compose --env-file .env -f docker-compose.dev.yaml up
docker compose --env-file .env -f docker-compose.dev.yaml down
```

DEV publishes port `5173`, has no mounts or volumes, and serves the built frontend with Vite preview.

### PROD

The `.env` below is likewise used for Compose interpolation; it is not copied into the Nginx runtime container by the Compose file.

```sh
docker compose --env-file .env -f docker-compose.prod.yaml build
docker compose --env-file .env -f docker-compose.prod.yaml up
docker compose --env-file .env -f docker-compose.prod.yaml down
```

PROD publishes port `80`, has no mounts or volumes, and serves the static build with Nginx.

## Local URLs

When Compose runs on the developer's machine, the configured ports provide these URLs:

| Environment | Frontend |
| --- | --- |
| LOCAL | [http://localhost:5173](http://localhost:5173/) |
| DEV | [http://localhost:5173](http://localhost:5173/) |
| PROD | [http://localhost](http://localhost/) |

Remote DEV and PROD hostnames are not defined by this repository.
