# JWT API

This simple API verifies the `Authorization` header using the OpenAuth client and returns the subject.

Run it using.

```bash
bun run --hot index.ts
```

Then visit `http://localhost:3001/` in your browser.

This works with the [React Client](../react) example that makes a call to this API after the auth flow.
