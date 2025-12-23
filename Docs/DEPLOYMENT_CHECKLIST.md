# 🚀 Deployment Checklist

## Pre-Deployment

### Code
- [x] All files created and tested locally
- [x] No hardcoded credentials in code
- [x] Environment variables documented in `.env.example`
- [x] Error handling implemented
- [x] Console logs helpful for debugging

### Firebase Setup
- [x] Firebase project created
- [x] Firestore database enabled
- [x] Realtime Database enabled
- [x] Service account key downloaded
- [x] Service account key Base64 encoded → FIREBASE_SERVICE_ACC_BASE64

### Twilio Setup
- [x] Twilio account created
- [x] WhatsApp sandbox enabled (or production)
- [x] Webhook URL configured: `https://your-domain.com/webhook`
- [x] Account SID and Auth Token captured

### Local Testing
- [x] `npm install` runs without errors
- [x] `node index.js` starts server successfully
- [x] `/health` endpoint responds with `{"status": "ok"}`
- [x] Customer messages route correctly
- [x] Admin endpoints work (`/admin/register-rider`, `/admin/riders`)
- [x] Rider registration works
- [x] Rider commands work
- [x] Firestore collections populate

---

## Deployment Steps

### 1. Choose Hosting
- [ ] Heroku (easiest)
- [ ] AWS EC2
- [ ] Google Cloud Run
- [ ] DigitalOcean
- [ ] Custom server

### 2. Create Environment Variables
```bash
# On hosting platform, set these:
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=whatsapp:+1234567890
FIREBASE_SERVICE_ACC_BASE64=xxx
FIREBASE_RTDB_URL=https://project.firebaseio.com
PORT=3000
NODE_ENV=production
```

### 3. Deploy Code
```bash
# Heroku example
git push heroku main

# Or manual deployment
scp -r . user@server:/app
ssh user@server
cd /app
npm install
npm start
```

### 4. Test Production
```bash
# Test health endpoint
curl https://your-domain.com/health

# Test admin endpoints
curl https://your-domain.com/admin/riders

# Register test rider
curl -X POST https://your-domain.com/admin/register-rider \
  -H "Content-Type: application/json" \
  -d '{"phone": "whatsapp:+254712345678", "name": "Test"}'
```

### 5. Configure Twilio Webhook
- [ ] Go to Twilio Console
- [ ] Update webhook URL to: `https://your-domain.com/webhook`
- [ ] Save changes
- [ ] Test with WhatsApp message

### 6. Enable HTTPS
- [ ] Use Let's Encrypt (free)
- [ ] Or platform-provided SSL
- [ ] Twilio requires HTTPS

### 7. Set Up Monitoring
- [ ] Enable error tracking (Sentry, Rollbar)
- [ ] Set up logging (cloud logs)
- [ ] Monitor Firestore usage
- [ ] Monitor Twilio usage

---

## Post-Deployment

### Verification
- [ ] Customer can order via WhatsApp
- [ ] Rider can receive orders
- [ ] Booking works end-to-end
- [ ] Firestore data appears
- [ ] Payments track correctly

### Admin Tasks
- [ ] Register production riders
- [ ] Brief riders on command usage
- [ ] Test with live WhatsApp numbers
- [ ] Monitor first orders

### Monitoring
- [ ] Check application logs daily
- [ ] Monitor error rates
- [ ] Check Firestore queries
- [ ] Monitor Twilio usage/costs

---

## Security Hardening (Production)

### Authentication
- [ ] Add JWT token to `/admin/*` endpoints
- [ ] Use environment variable for admin token
- [ ] Rate limit admin endpoints

### Input Validation
- [ ] Sanitize all user inputs
- [ ] Validate phone format (whatsapp:+)
- [ ] Validate order IDs format
- [ ] Add length limits to strings

### Error Handling
- [ ] Don't expose internal errors to users
- [ ] Log all errors server-side
- [ ] Return generic error messages
- [ ] Implement error recovery

### Database
- [ ] Enable Firestore backups
- [ ] Set up audit logging
- [ ] Create read-only roles for analytics
- [ ] Monitor data growth

---

## Scaling Considerations

### Current Limits
- Single server instance
- Firestore (auto-scales)
- Twilio (auto-scales)

### When to Scale
- [ ] > 100 concurrent users → Add load balancer
- [ ] > 1000 orders/day → Monitor Firestore queries
- [ ] > 10K rows → Consider data archival

### Scaling Steps
```bash
# Horizontal scaling
1. Add second server instance
2. Put behind load balancer
3. No code changes needed (stateless)

# Database scaling
1. Add Firestore indexes (auto-suggested)
2. Archive old orders to different collection
3. Consider RTDB cleanup script
```

---

## Documentation for Team

### For Riders
- [ ] How to use WhatsApp commands
- [ ] How to check payment status
- [ ] How to withdraw earnings
- [ ] Customer support number

### For Admin
- [ ] How to register new riders
- [ ] How to check system status
- [ ] How to monitor orders
- [ ] How to handle complaints

### For Developers
- [ ] Code structure explanation
- [ ] API documentation
- [ ] Deployment instructions
- [ ] Emergency procedures

---

## Disaster Recovery

### Backup Plan
- [ ] Firestore automatic backups enabled
- [ ] Code in Git repository
- [ ] Environment variables documented (not in repo)
- [ ] Rollback procedure documented

### If Service Goes Down
1. Check server logs
2. Restart application
3. Verify Firestore connection
4. Verify Twilio connection
5. Notify riders (via WhatsApp)
6. Notify customers (via WhatsApp)

### If Data is Lost
1. Restore Firestore from backup
2. Contact Firebase support
3. Consider manual recovery
4. Review backup procedures

---

## Ongoing Maintenance

### Daily
- [ ] Monitor error logs
- [ ] Check Twilio alerts
- [ ] Verify bot responses

### Weekly
- [ ] Review order analytics
- [ ] Check Firestore usage
- [ ] Monitor rider activity
- [ ] Customer feedback review

### Monthly
- [ ] Performance analysis
- [ ] Cost review (Twilio, Firebase)
- [ ] User feedback compilation
- [ ] Update documentation

---

## Launch Checklist (Week 1)

### Day 1: Deploy
- [ ] Code deployed to production
- [ ] Webhooks configured
- [ ] HTTPS enabled
- [ ] Admin can access endpoints

### Day 2: Test
- [ ] Internal team tests end-to-end
- [ ] Multiple test customers
- [ ] Multiple test riders
- [ ] Payment flow verified

### Day 3: Register Riders
- [ ] Recruit 5-10 test riders
- [ ] Register them via admin
- [ ] Brief them on commands
- [ ] Test with real WhatsApp

### Day 4: Soft Launch
- [ ] Invite 20-30 close contacts
- [ ] Orders from test users
- [ ] Riders deliver test orders
- [ ] Collect feedback

### Day 5: Monitor & Fix
- [ ] Watch all orders real-time
- [ ] Fix any bugs immediately
- [ ] Improve based on feedback
- [ ] Document issues

### Week 2: Scale
- [ ] Open to wider audience
- [ ] Monitor system load
- [ ] Register more riders
- [ ] Continue improving

---

## Success Metrics (First Month)

### Technical
- [ ] 99.5% uptime
- [ ] < 1s average response time
- [ ] < 5% error rate
- [ ] Firestore within quota

### Business
- [ ] 50+ orders placed
- [ ] 10+ active riders
- [ ] 95%+ delivery rate
- [ ] KES 15,000+ in revenue

### User Satisfaction
- [ ] 4.5+ star rating
- [ ] < 5% cancelled orders
- [ ] Positive rider feedback
- [ ] No data loss incidents

---

## Contact & Support

### During Launch
- **Dev Lead**: On-call for bugs
- **Admin**: Monitor orders & riders
- **Support**: Handle customer issues
- **Finance**: Track revenue

### Emergency Procedures
- **Server down**: Restart service, check logs
- **Payment stuck**: Check Firestore, retry
- **Rider issue**: Message via WhatsApp
- **Customer issue**: Message via WhatsApp

---

## Sign-Off

- [ ] Technical: Ready to deploy
- [ ] Security: Reviewed & approved
- [ ] Business: Launch plan confirmed
- [ ] Support: Team trained

**Deployment Date**: _______________
**Deployed By**: _______________
**Approved By**: _______________

---

## Post-Deployment Notes

```
[Date] Deployment successful
  - Health check: OK
  - Database: OK
  - Twilio: OK
  - First orders: OK

[Issues encountered]:
[Resolutions]:
[Follow-up tasks]:
```

---

## You Are Ready! 🚀

All systems operational. Time to serve Nairobi with Roho Fuel!

