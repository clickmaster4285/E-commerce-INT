# Legacy one-off scripts (archive after ops confirm)

Yeh scripts ab bhi `backend/scripts/` root me hain aur `package.json` se point ho sakte hain. Naya kaam `../NNN-*.js` migration pattern se karo (`run.js`).

**Archive candidates** (tab move karo jab ops team confirm kar de ke production par safely chal chuke hain aur dubara zarurat nahi):

- `renameAuthCollections.js`
- `backfillSubdomains.js`
- `migrateAttributesPerStore.js`

Abhi in files ko move mat karo jab tak `package.json` scripts unhe reference karti hon.