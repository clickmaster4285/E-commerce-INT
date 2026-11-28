# Backend

Express 5 + Mongoose 9 multi-tenant API. Store isolation is Host + AsyncLocalStorage (`resolveStore` / `tenantScope`).

## Prerequisites

- Node.js ≥ 24
- **MongoDB replica set** (required — the app exits on boot without `hello.setName`)

### Local replica set (Windows / this machine)

`mongod.cfg` already has:

```yaml
replication:
  replSetName: rs0
```

On a **new** developer machine:

1. Add the same `replication` block under `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg` (or your mongod config path).
2. Restart the MongoDB Windows service.
3. Initiate once:

```bash
mongosh --eval "rs.initiate({_id:'rs0', members:[{_id:0, host:'127.0.0.1:27017'}]})"
```

4. Verify: `mongosh --eval "rs.status().ok"` → `1`.

Docker alternative:

```bash
docker run -d --name mongo-rs -p 27017:27017 mongo:8 --replSet rs0 --bind_ip_all
docker exec mongo-rs mongosh --eval "rs.initiate({_id:'rs0', members:[{_id:0, host:'127.0.0.1:27017'}]})"
```

### Connection string

Copy `.env.example` → `.env`. Use:

```
MONGO_URI=mongodb://127.0.0.1:27017/ecommerce?replicaSet=rs0&retryWrites=true&w=majority
```

Use `127.0.0.1`, not `localhost`, so the driver matches the rs member host.

Optional: `MONGO_PROFILE_SLOWMS=100` enables the MongoDB profiler in staging (level 1).

## Commands

```bash
npm run dev          # nodemon server.js
npm start
npm test             # node --test (files in test/)
npm run migrate:indexes
```

`config/db.js` sets pool/timeouts (`maxPoolSize` 50, `serverSelectionTimeoutMS` 5000, …) and **`autoIndex: false` in production**. Build indexes with `npm run migrate:indexes` (and related scripts), not on every boot.

Transactions: `utils/tx.js` → `withTx(fn)` (snapshot + majority). There is **no** standalone fallback.

Store purge (soft-deleted store): document deletes run inside `withTx`; uploads are removed after commit.

```bash
node scripts/purgeStore.js --storeId <ObjectId>           # dry run
node scripts/purgeStore.js --storeId <ObjectId> --apply
```

## Production checklist (§3.1)

- [ ] **3-member replica set** (or Atlas M10+) — never a single node for failover.
- [ ] Auth + keyfile/x.509 internal auth, TLS, `bindIp` private only.
- [ ] URI lists every member: `replicaSet=rs0&retryWrites=true&w=majority&readPreference=primary`  
  (`secondaryPreferred` only for analytics jobs — never money/stock).
- [ ] Point-in-time backups (Atlas continuous, or `mongodump --oplog` + oplog archive). Test a restore quarterly.
- [ ] Before every migration: `mongodump` (or Atlas snapshot). Version migration scripts under `scripts/` (§3.8).
- [ ] Staging: set `MONGO_PROFILE_SLOWMS=100`, capture `explain("executionStats")` for hot queries before/after index work (§3.3).

## Later (not in this sprint)

Change streams for cross-instance cache invalidation (`store:changed`, `publicCache`), socket fan-out, and read-model refresh (§3.4 / scale sprint). They can replace some Redis pub/sub once Redis + multi-instance are in place.
