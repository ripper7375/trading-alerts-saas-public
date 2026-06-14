# When Claude Code Context is nearly full + You want to cleanup context while preserve necessary context for further task feed to claude code

# Step 1: If you have test/build dirs, exclude them first

/add-dir --exclude tests,**tests**,build,.next,dist,node_modules

# Step 2: Run compact (this does the heavy lifting)

/compact

# Step 3: Always review what changed

/diff

# Step 4: Proceed with your next Claude Code task

# (You should now have ~260–320k tokens free)
