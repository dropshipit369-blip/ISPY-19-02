# Authentication Troubleshooting Guide

## Error: "Failed to fetch" when signing in

This error occurs when the browser cannot reach the Supabase authentication servers. Here's how to fix it.

## Quick Diagnostics

### 1. Check Your Environment Variables

The app needs these variables in `.env`:

```
VITE_SUPABASE_URL="https://urthrjkbynnpxvgwmsdq.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**To verify:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run:
```javascript
console.log("URL:", import.meta.env.VITE_SUPABASE_URL)
console.log("Key:", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
```

If either shows `undefined`, the `.env` file isn't loaded properly.

### 2. Run Diagnostic Check

In the browser console, run:

```javascript
import { runSupabaseDiagnostics } from './src/utils/supabase-diagnostics.ts'
runSupabaseDiagnostics()
```

This will check:
- ✅ Environment variables are set
- ✅ Network connectivity to Supabase
- ✅ CORS headers are correct
- ✅ Authentication endpoint is reachable

## Common Causes & Fixes

### Issue 1: Supabase Project Not Active

**Symptoms:** Status 401 or 403 errors

**Fix:**
1. Go to https://supabase.com/dashboard/projects
2. Make sure your project is in **"Active"** status (green dot)
3. If suspended, click to reactivate

### Issue 2: Wrong Environment Variables

**Symptoms:** Environment variables show `undefined`

**Fix (Development):**
```bash
# Ensure .env file exists and has:
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_ANON_KEY"

# Restart dev server
npm run dev
```

**Fix (Production/Vercel):**
1. Go to Vercel Dashboard > Project Settings > Environment Variables
2. Add the Supabase credentials
3. Redeploy the project

### Issue 3: Network/Firewall Blocking

**Symptoms:** "Failed to fetch" with no additional error details

**Possible Causes:**
- Corporate firewall blocking external APIs
- ISP blocking certain domains
- VPN or proxy interfering
- Browser extensions blocking requests

**Fix:**
1. Try on a different network (mobile hotspot, different WiFi)
2. Try in Incognito mode (to bypass extensions)
3. Check if `supabase.co` domain is accessible:
   - Open DevTools Network tab
   - Try to access: https://urthrjkbynnpxvgwmsdq.supabase.co
4. Disable VPN or proxy temporarily

### Issue 4: CORS (Cross-Origin) Issue

**Symptoms:** CORS error in browser console

**Fix:**
1. Go to https://supabase.com/dashboard/project/_/settings/auth
2. Under "URL Configuration" section:
   - Add your app URL to "Redirect URLs"
   - For localhost: `http://localhost:5173/`
   - For production: `https://yourdomain.com/`
3. Save and wait ~1 minute for changes to propagate

### Issue 5: Expired or Invalid API Key

**Symptoms:** 401/403 errors even with correct email/password

**Fix:**
1. Go to https://supabase.com/dashboard/project/_/settings/api
2. Copy the **Anon Key** (not the secret key!)
3. Update `.env` with the new key
4. Restart your dev server or redeploy

## Advanced Debugging

### Check Supabase API Status

Go to https://status.supabase.com/ to see if there are any service outages.

### Enable Verbose Logging

Add this to your Login component temporarily:

```typescript
const { error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// Add detailed logging
if (error) {
  console.error("Auth Error Details:", {
    message: error.message,
    status: error.status,
    code: (error as any).code,
  });
}
```

### Monitor Network Requests

1. Open DevTools > Network tab
2. Try to login
3. Look for requests to `supabase.co` domain
4. Check the response status and headers

## Browser-Specific Issues

### Chrome/Edge
- Try Incognito mode (Ctrl+Shift+N)
- Clear cache (Ctrl+Shift+Delete)
- Check if extensions are interfering

### Firefox
- Try Private Window (Ctrl+Shift+P)
- Clear cookies/cache
- Check about:config for network restrictions

### Safari
- Check if "Block cross-site tracking" is enabled
- Clear Safari cache and cookies
- Try another browser to compare

## Deployment-Specific Issues

### On Vercel
1. Check environment variables are set correctly
2. Redeploy after adding environment variables
3. Verify Supabase URL in deployment is correct
4. Check Supabase redirect URLs includes your Vercel domain

### On Self-Hosted Server
1. Verify network access to `supabase.co`
2. Check firewall rules
3. Ensure SSL/TLS certificates are valid
4. Verify Supabase redirect URLs includes your domain

## Getting Help

If none of these solutions work:

1. **Gather diagnostic information:**
   ```javascript
   // Run in console
   await runSupabaseDiagnostics()
   // Copy the output
   ```

2. **Check Supabase logs:**
   - Go to https://supabase.com/dashboard/project/_/logs
   - Look for failed authentication attempts

3. **Contact Support:**
   - Supabase Support: https://supabase.com/support
   - Include:
     - Screenshot of the error
     - Output from diagnostics
     - Your Supabase project URL
     - Any relevant log entries

## Checklist

- [ ] `.env` file has both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Supabase project is in **Active** status
- [ ] Ran diagnostics and network checks pass
- [ ] Tried on different network (mobile hotspot)
- [ ] Tried in Incognito/Private mode
- [ ] Checked Supabase redirect URLs are configured
- [ ] API key is not expired (less than 1 year old)
- [ ] No VPN or proxy is interfering
- [ ] Supabase status page shows all green

## Still Not Working?

Try these nuclear options:

1. **Clear Everything:**
   ```bash
   # Clear browser cache
   # Delete .env file and create new one with fresh credentials
   # Restart dev server
   npm run dev
   ```

2. **Create New Supabase Project:**
   - Sometimes the project gets into a bad state
   - Create a new project
   - Copy the new credentials to `.env`
   - Test authentication

3. **Check Browser Console for Detailed Errors:**
   - DevTools > Console
   - Look for full error stack trace
   - It might give more specific information than "Failed to fetch"
