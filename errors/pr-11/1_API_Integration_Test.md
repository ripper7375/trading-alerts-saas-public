The job failed due to a TypeScript error at line 125 in app/api/admin/affiliates/reports/commission-owings/route.ts: "Object is possibly 'undefined'." The problematic line:

```typescript
const oldestPending =
  affiliate.commissions.length > 0 ? affiliate.commissions[0].earnedAt : null;
```

The affiliate.commissions property could be undefined if no commissions exist for an affiliate. To fix this, explicitly check that commissions is defined and has length:

```typescript
const oldestPending =
  affiliate.commissions && affiliate.commissions.length > 0
    ? affiliate.commissions[0].earnedAt
    : null;
```

Replace the code at line 124-126 with this version to handle the possible undefined value. This will resolve the type error and allow the job to complete successfully.

You can view the relevant file here (ref: c7c9d41df1bfcfd2c6afa4318ea9bd19c24f32b5):
app/api/admin/affiliates/reports/commission-owings/route.ts
