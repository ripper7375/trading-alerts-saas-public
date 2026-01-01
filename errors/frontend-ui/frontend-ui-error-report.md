PS D:\SaaS Project\trading-alerts-saas-public> pnpm dev

> trading-alerts-saas-v7@0.1.0 dev D:\SaaS Project\trading-alerts-saas-public
> next dev

▲ Next.js 15.5.9

- Local: http://localhost:3000
- Network: http://192.168.16.1:3000
- Environments: .env.local
- Experiments (use with caution):
  · serverActions

✓ Starting...
✓ Ready in 22.4s
○ Compiling / ...
✓ Compiled / in 28.1s (730 modules)
✓ Compiled in 1757ms (296 modules)
GET / 200 in 30081ms
○ Compiling /pricing ...
✓ Compiled /pricing in 1971ms (748 modules)
GET /pricing 200 in 2578ms
○ Compiling /\_not-found ...
Watchpack Error (initial scan): Error: EINVAL: invalid argument, lstat 'D:\System Volume Information'
⨯ ./lib/auth/auth-options.ts:3:1
Module not found: Can't resolve 'jsonwebtoken'
1 | import { PrismaAdapter } from '@next-auth/prisma-adapter';
2 | import bcrypt from 'bcryptjs';

> 3 | import jwt from 'jsonwebtoken';

    | ^

4 | import { type NextAuthOptions } from 'next-auth';
5 | import type { Account, User } from 'next-auth';
6 | import type { Adapter, AdapterUser } from 'next-auth/adapters';

https://nextjs.org/docs/messages/module-not-found

Import trace for requested module:
./app/api/auth/[...nextauth]/route.ts
Watchpack Error (initial scan): Error: EINVAL: invalid argument, lstat 'D:\System Volume Information'
Watchpack Error (initial scan): Error: EINVAL: invalid argument, lstat 'D:\System Volume Information'
Watchpack Error (initial scan): Error: EINVAL: invalid argument, lstat 'D:\System Volume Information'
Watchpack Error (initial scan): Error: EINVAL: invalid argument, lstat 'D:\System Volume Information'
⨯ ./lib/auth/auth-options.ts:3:1
Module not found: Can't resolve 'jsonwebtoken'
1 | import { PrismaAdapter } from '@next-auth/prisma-adapter';
2 | import bcrypt from 'bcryptjs';

> 3 | import jwt from 'jsonwebtoken';

    | ^

4 | import { type NextAuthOptions } from 'next-auth';
5 | import type { Account, User } from 'next-auth';
6 | import type { Adapter, AdapterUser } from 'next-auth/adapters';

https://nextjs.org/docs/messages/module-not-found

Import trace for requested module:
./app/api/auth/[...nextauth]/route.ts
⨯ ./lib/auth/auth-options.ts:3:1
Module not found: Can't resolve 'jsonwebtoken'
1 | import { PrismaAdapter } from '@next-auth/prisma-adapter';
2 | import bcrypt from 'bcryptjs';

> 3 | import jwt from 'jsonwebtoken';

    | ^

4 | import { type NextAuthOptions } from 'next-auth';
5 | import type { Account, User } from 'next-auth';
6 | import type { Adapter, AdapterUser } from 'next-auth/adapters';

https://nextjs.org/docs/messages/module-not-found

Import trace for requested module:
./app/api/auth/[...nextauth]/route.ts
GET /api/config/affiliate 500 in 21465ms
GET /api/geo/detect 500 in 21451ms
GET /api/auth/session 500 in 21509ms
GET /pricing 500 in 4537ms
POST /api/auth/_log 500 in 134ms
GET /pricing 500 in 103ms
GET /pricing 500 in 94ms
<w> [webpack.cache.PackFileCacheStrategy] Caching failed for pack: Error: ENOENT: no such file or directory, rename 'D:\SaaS Project\trading-alerts-saas-public\.next\cache\webpack\client-development-fallback\0.pack.gz_' -> 'D:\SaaS Project\trading-alerts-saas-public\.next\cache\webpack\client-development-fallback\0.pack.gz'
<w> [webpack.cache.PackFileCacheStrategy] Caching failed for pack: Error: ENOENT: no such file or directory, rename 'D:\SaaS Project\trading-alerts-saas-public\.next\cache\webpack\client-development-fallback\0.pack.gz\_' -> 'D:\SaaS Project\trading-alerts-saas-public\.next\cache\webpack\client-development-fallback\0.pack.gz'
GET / 500 in 85ms
GET / 500 in 85ms
GET / 500 in 91ms
GET / 500 in 86ms
