# Install dependency analysis tools

npm install -g madge

# Analyze circular dependencies

madge --circular --extensions ts,tsx src/

# Generate dependency graph

madge --image dependency-graph.svg src/

# Find orphaned files

npx depcheck
