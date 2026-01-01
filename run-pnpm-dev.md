Step 1: Find the process using port 3000

Run this in PowerShell:

netstat -ano | findstr :3000

You'll see output like:

TCP 0.0.0.0:3000 0.0.0.0:0 LISTENING 51372

The last number (e.g., 51372) is the PID (Process ID).

===========================================================

Step 2: Kill the process

Replace 51372 with the PID you found:

taskkill /PID 51372 /F

============================================================

Step 3: Restart your dev server

pnpm dev

It should now run on port 3000.

============================================================

Step 4: Sync database (for the missing SystemConfig table)

In a new terminal:

pnpm prisma db push
