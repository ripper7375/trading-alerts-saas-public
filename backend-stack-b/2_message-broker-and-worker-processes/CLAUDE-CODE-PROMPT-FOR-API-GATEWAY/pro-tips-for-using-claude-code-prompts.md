💡 Pro Tips

Use ONE Claude Code session for all 4 prompts

Maintains context between prompts
Documents already uploaded
Consistent architecture

Review code before deploying

Check all 57 columns match your DTO
Verify environment variables
Test locally first

Follow deployment order

Redis first (everything depends on it)
Test each service before moving to next
Monitor dashboards immediately

Start with one terminal

Test with terminal_001 for 24 hours
Verify < 1% error rate
Then gradually add more terminals

📊 Success Criteria
After implementation:

✅ API Gateway handles 200+ req/min
✅ Validation error rate < 0.5%
✅ Workers process 12,000+ bars/day
✅ Grafana shows 4 working dashboards
✅ Alerts configured and tested
✅ All services healthy on Railway
