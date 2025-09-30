#!/usr/bin/env node

const frontendIssues = [
  {'body':'## Sentry Issue: VIKING-EVENT-MGMT-8H\n\n**Status:** 1 occurrence, 1 affected user  \n**First Seen:** 2025-09-13 | **Last Seen:** 2025-09-13  \n**Sentry URL:** https://walton-vikings.sentry.io/issues/VIKING-EVENT-MGMT-8H\n\n### 📊 Version Tracking\n| Metric | Version | Date |\n|--------|---------|------|\n| **First Seen** | vikings-eventmgmt-mobile@2.3.7 | 2025-09-13 |\n| **Current Status** | ⚠️ **RECENT PRODUCTION ERROR** - Mobile Safari 18.6 on iPhone |\n\n### Error Details\n- **Error:** TypeError: Importing a module script failed\n- **Environment:** Production (vikingeventmgmt.onrender.com/events)\n- **Platform:** iPhone/Mobile Safari 18.6, iOS 18.6.2\n- **Release:** vikings-eventmgmt-mobile@2.3.7\n\n### Impact\n- Production error affecting mobile users\n- Module loading failure preventing app functionality\n- Specifically impacts /events route on mobile Safari\n\n### Technical Analysis\nModule script import failure on production deployment:\n- **Location:** /events route\n- **Browser:** Mobile Safari 18.6 on iPhone\n- **Error Source:** ../../node_modules/react-dom/cjs/react-dom-client.production.js\n- **Pattern:** Module import/loading issue specific to production build\n\n### Possible Causes\n1. **Build Configuration:** Production build creating invalid module references\n2. **Mobile Compatibility:** Safari-specific module loading issues  \n3. **Asset Optimization:** Code splitting or minification breaking imports\n4. **CDN/Caching:** Render deployment serving stale or corrupt assets\n\n### Investigation Steps\n1. Test /events route on Mobile Safari specifically\n2. Check production build output for module reference errors\n3. Verify Vite/React production configuration\n4. Test across different mobile browsers\n5. Check Render deployment asset serving\n\n### Suggested Fixes\n- Review Vite production build configuration\n- Test mobile Safari compatibility in production\n- Verify module import paths in build output\n- Consider adding mobile Safari specific handling\n\n### Priority\nHigh - Production error affecting mobile users on core functionality\n\n---\n**🔄 Version Status:** New issue in current vikings-eventmgmt-mobile@2.3.7  \n**📅 Auto-created from Sentry error VIKING-EVENT-MGMT-8H**','labels':[{'id':'LA_kwDOPG5dyM8AAAACEd9neg','name':'bug','description':'Something isn\'t working','color':'d73a4a'},{'id':'LA_kwDOPG5dyM8AAAACH0FzGg','name':'ux','description':'','color':'79eb2d'},{'id':'LA_kwDOPG5dyM8AAAACI1H7HA','name':'sentry','description':'','color':'fcf413'}],'number':149,'title':'Fix module import failure in production (VIKING-EVENT-MGMT-8H)'},
  {'number':104,'title':'Fix authentication failures in demo mode','sentryId':'VIKING-EVENT-MGMT-10'},
  {'number':103,'title':'Fix backend API fetch failures on Render deployment','sentryId':'VIKING-EVENT-MGMT-1T'},
  {'number':106,'title':'Backend API connectivity failure for mobile users (VIKING-EVENT-MGMT-2F)','sentryId':'VIKING-EVENT-MGMT-2F'},
];

const backendIssues = [
  {'number':37,'title':'Fix CORS configuration for /health endpoint','sentryId':'NODEJS-API-BACKEND-9'},
  {'number':36,'title':'Fix API 403 error in /get-members-grid endpoint','sentryId':'NODEJS-API-BACKEND-B'},
];

const sentryIdRegex = /VIKING-EVENT-MGMT-[A-Z0-9]+|NODEJS-API-BACKEND-[A-Z0-9]+/g;

function extractSentryIds(issueBody, issueTitle) {
  const ids = new Set();

  if (issueBody) {
    const bodyMatches = issueBody.match(sentryIdRegex);
    if (bodyMatches) bodyMatches.forEach(id => ids.add(id));
  }

  if (issueTitle) {
    const titleMatches = issueTitle.match(sentryIdRegex);
    if (titleMatches) titleMatches.forEach(id => ids.add(id));
  }

  return Array.from(ids);
}

console.log('=== Frontend Issues with Sentry References ===\n');
frontendIssues.forEach(issue => {
  const sentryIds = extractSentryIds(issue.body, issue.title);
  if (sentryIds.length > 0) {
    console.log(`Issue #${issue.number}: ${issue.title}`);
    console.log(`Sentry IDs: ${sentryIds.join(', ')}\n`);
  }
});

console.log('\n=== Backend Issues with Sentry References ===\n');
backendIssues.forEach(issue => {
  const sentryIds = extractSentryIds(issue.body, issue.title);
  if (sentryIds.length > 0) {
    console.log(`Issue #${issue.number}: ${issue.title}`);
    console.log(`Sentry IDs: ${sentryIds.join(', ')}\n`);
  }
});

const activeSentryErrors = {
  frontend: [
    'VIKING-EVENT-MGMT-10',  // 187 events, 4 users - Authentication failed
    'VIKING-EVENT-MGMT-16',  // 255 events, 3 users - Failed to fetch localhost:3000
    'VIKING-EVENT-MGMT-9G',  // 159 events, 1 user - Invalid allTerms parameter
    'VIKING-EVENT-MGMT-1G',  // 85 events, 2 users - Failed to retrieve flexirecord data
    'VIKING-EVENT-MGMT-9H',   // 44 events, 1 user - Large HTTP payload
  ],
  backend: [
    'NODEJS-API-BACKEND-9',   // 1007 events, 0 users - CORS error
  ],
};

console.log('\n=== Unmapped High-Priority Errors ===\n');

const mappedFrontendIds = new Set(frontendIssues.flatMap(i => extractSentryIds(i.body, i.title)));
const mappedBackendIds = new Set(backendIssues.flatMap(i => extractSentryIds(i.body, i.title)));

console.log('Frontend errors needing GitHub issues:');
activeSentryErrors.frontend.forEach(id => {
  if (!mappedFrontendIds.has(id)) {
    console.log(`  - ${id} (not tracked in GitHub)`);
  } else {
    console.log(`  - ${id} (already tracked)`);
  }
});

console.log('\nBackend errors needing GitHub issues:');
activeSentryErrors.backend.forEach(id => {
  if (!mappedBackendIds.has(id)) {
    console.log(`  - ${id} (not tracked in GitHub)`);
  } else {
    console.log(`  - ${id} (already tracked)`);
  }
});
