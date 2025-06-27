# API Mocking System for Vikings Event Management

## 🛡️ Security Protection Against Unauthorized API Calls

This API mocking system was implemented to prevent **accidental real API calls during automated testing**, which was causing 700+ unauthorized OSM API requests from CI/CD pipelines.

## 🔧 How It Works

### Automatic Initialization
- **All Cypress tests automatically use mocked API responses**
- **Real API calls are blocked by default** in testing environments
- **No manual configuration needed** for basic test runs

### Key Components

1. **`cypress/support/api-mocks.js`** - Central mocking system
2. **`cypress/support/e2e.js`** - Auto-initializes mocks for all tests  
3. **`cypress/fixtures/*.json`** - Realistic mock data responses
4. **Environment variables** - Control mocking behavior

## 🚨 Critical Security Features

### Prevents Real API Calls
```javascript
// Blocks ALL backend API requests
cy.intercept('GET', '**/api/**', mockGenericAPI).as('mockGenericAPI');

// Emergency blocker for direct OSM calls (should never happen)
cy.intercept('GET', '**onlinescoutmanager.co.uk/**', blockDirectOSMCalls);
```

### CI/CD Pipeline Protection
In GitHub Actions, these environment variables **force mocking**:
```yaml
env:
  CYPRESS_ENABLE_API_MOCKING: 'true'  # Force mocking ON
  CYPRESS_CI: 'true'                   # CI environment detection
  VITE_API_URL: 'http://localhost:3001/mock-api'  # Mock endpoint
  NODE_ENV: 'test'                     # Test environment
```

## 📊 Mock Data Available

### Sections (getUserRoles)
- 3 test sections: Scouts, Cubs, Beavers
- Realistic permission levels and metadata
- Rate limit information included

### Events (getEvents)  
- 3 sample events with dates, times, locations
- Cost and attendance information
- Proper OSM API response structure

### Attendance (getEventAttendance)
- 5 mock members with varied attendance status
- Patrol assignments and notes
- Payment and medical info

## ⚙️ Configuration Options

### Enable/Disable Mocking

**Local Development (test with real API):**
```bash
# In .env file
CYPRESS_ENABLE_API_MOCKING=false
```

**CI/CD Pipeline (always mocked):**
```yaml
# In GitHub Actions - cannot be disabled
CYPRESS_ENABLE_API_MOCKING: 'true'
```

### Environment Detection
The system automatically detects:
- **CI environments** → Always use mocks
- **Local development** → Use mocks by default (configurable)
- **Test runs** → Always use mocks

## 🔍 Monitoring and Debugging

### Console Logging
When mocking is active, you'll see:
```
🛡️ Initializing API mocking system...
🔐 Mocking auth endpoint: /api/auth/callback
👤 Mocking user roles endpoint: /api/ext/members/contact/grid/
📅 Mocking events endpoint: /api/ext/events/
```

### Blocked API Warnings
If a real API call is attempted:
```
🚫 Blocked external API call: https://example.com/api
🚨 BLOCKED DIRECT OSM API CALL: https://onlinescoutmanager.co.uk/...
```

## 🛠️ Usage in Tests

### Automatic (Recommended)
```javascript
// No setup needed - mocks are automatically active
describe('My Test', () => {
  it('should work with mocked APIs', () => {
    cy.visit('/');
    // All API calls are automatically mocked
  });
});
```

### Manual Mock Control
```javascript
// Use specific mock scenarios
cy.mockOSMBlocked();     // Simulate API blocking
cy.mockOSMSuccess();     // Use fixture data
cy.mockRateLimited();    // Simulate rate limiting
```

### Custom Mock Responses
```javascript
// Override with custom data
cy.intercept('GET', '**/api/ext/events/**', {
  fixture: 'custom-events.json'
}).as('customEvents');
```

## 🚀 Testing the Mocking System

### Verify Mocks Are Active
```bash
npm run cypress:open
# Check browser console for mocking initialization messages
```

### Test CI/CD Mocking
```bash
# Simulate CI environment
CYPRESS_CI=true CYPRESS_ENABLE_API_MOCKING=true npm run cypress:run
```

### Monitor Network Tab
- Open browser dev tools → Network tab
- Run tests and verify **no real API calls** to external domains
- All requests should be intercepted and mocked

## 🔒 Security Benefits

1. **Prevents API Abuse** - No real OSM API calls during automated testing
2. **Protects Rate Limits** - Avoids consuming OSM API quotas
3. **Prevents Blocking** - Eliminates risk of OSM blocking your OAuth client
4. **Cost Control** - Avoids unexpected API charges
5. **Reliable Testing** - Tests don't depend on external API availability

## 📝 Maintenance

### Adding New Mock Endpoints
1. Add intercept in `api-mocks.js`
2. Create fixture file if needed
3. Update mock function to return realistic data

### Updating Mock Data
1. Edit fixture files in `cypress/fixtures/`
2. Ensure data structure matches real OSM API responses
3. Include rate limit info for realism

## ⚠️ Important Notes

- **API mocking is ALWAYS ON in CI/CD** - cannot be disabled for security
- **Local development uses mocks by default** - change `.env` only if needed
- **Real API testing should be done manually** - not in automated pipelines
- **Monitor console logs** to verify mocking is active
- **All external API calls are blocked** except localhost/127.0.0.1

## 🆘 Troubleshooting

### If Real API Calls Are Being Made
1. Check console for mocking initialization messages
2. Verify `CYPRESS_ENABLE_API_MOCKING=true` in environment
3. Look for "BLOCKED" warnings in browser console
4. Ensure `api-mocks.js` is being imported correctly

### If Tests Fail Due to Mocking
1. Check if test expects specific real API responses
2. Update fixture data to match expected format  
3. Add custom intercepts for specific test needs
4. Ensure mock data structure matches your app's expectations

---

**🛡️ This system protects against the 700+ unauthorized OSM API calls that were previously being made during CI/CD runs.**