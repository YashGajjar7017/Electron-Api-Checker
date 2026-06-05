# GitHub OAuth Setup Guide

## Overview
This application supports GitHub OAuth authentication to allow users to sign in with their GitHub account and access their GitHub profile information.

## Prerequisites
- GitHub account (free or paid)
- Access to create OAuth applications on GitHub

## Step-by-Step Setup

### 1. Register a GitHub OAuth Application

1. Go to https://github.com/settings/developers
2. Click **"New GitHub App"** or **"New OAuth App"** (depending on your preference)
3. Fill in the application details:
   - **Application name**: `API Checker` (or your preferred name)
   - **Homepage URL**: `http://localhost:8000` (for development)
   - **Authorization callback URL**: `http://localhost:8000/auth/github/callback`
   - **Description** (optional): `API testing and management desktop application`

4. Click **"Register application"**

### 2. Obtain Your Credentials

After registering, you'll see:
- **Client ID**: This is your `REACT_APP_GITHUB_CLIENT_ID`
- **Client Secret**: Generate this and use it as `REACT_APP_GITHUB_CLIENT_SECRET`

**Important**: Keep your Client Secret secure and never commit it to version control.

### 3. Configure Environment Variables

Create or update your `.env` file in the project root:

```bash
# GitHub OAuth Configuration
REACT_APP_GITHUB_CLIENT_ID=your_client_id_here
REACT_APP_GITHUB_CLIENT_SECRET=your_client_secret_here
REACT_APP_GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback
REACT_APP_GITHUB_SCOPE=user:email read:user
REACT_APP_BACKEND_URL=http://localhost:8000

# Backend Configuration
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_CALLBACK_URL=http://localhost:8000/auth/github/callback
BACKEND_URL=http://localhost:8000

# Database
MONOGDB_URI=mongodb://localhost:27017/api_checker

# Secrets
SESSION_SECRET=your_random_secret_here
JWT_SECRET=your_random_jwt_secret_here
JWT_EXPIRATION=1h
```

### 4. Restart the Application

After updating the `.env` file:

1. **For development**: 
   ```bash
   npm run electron-dev
   ```

2. **For production**: 
   ```bash
   npm run electron-build
   ```

### 5. Test GitHub Login

1. Launch the application
2. Navigate to the GitHub authentication section
3. Click **"Sign in with GitHub"**
4. You'll be redirected to GitHub
5. Authorize the application
6. You'll be redirected back to the app with your profile information

## Troubleshooting

### "GitHub OAuth client ID is not configured"

**Problem**: The GitHub login button is disabled with this message.

**Solution**: 
- Verify that `REACT_APP_GITHUB_CLIENT_ID` is set in your `.env` file
- The value should not be empty
- Restart the application after changing `.env` values
- Check that the `.env` file is in the project root directory

### Callback URL Mismatch

**Problem**: Error like "redirect_uri_mismatch"

**Solution**:
- Ensure the callback URL in your GitHub OAuth app settings exactly matches `REACT_APP_GITHUB_REDIRECT_URI`
- Common callback URLs:
  - Development: `http://localhost:8000/auth/github/callback`
  - Production: `https://yourdomain.com/auth/github/callback`

### Token Exchange Fails

**Problem**: Login appears to work but profile doesn't load.

**Solution**:
- Verify the backend server is running on `REACT_APP_BACKEND_URL`
- Check that the backend has the correct GitHub credentials
- Review backend logs for detailed error messages

### Scope Issues

**Problem**: User profile not loading completely.

**Solution**:
- The app requests `user:email read:user` scopes by default
- These scopes allow reading user email and profile information
- Modify `REACT_APP_GITHUB_SCOPE` if additional permissions are needed

## Production Deployment

### Security Considerations

1. **Never commit secrets**: Use environment variables
2. **Use HTTPS**: Always use HTTPS in production URLs
3. **Secure cookies**: Enable secure cookie flags in backend
4. **Rate limiting**: Implement rate limiting on the backend
5. **Token storage**: Use secure storage mechanisms for tokens

### Production Callback URL

Update your GitHub OAuth app settings with your production domain:
- Callback URL: `https://yourdomain.com/auth/github/callback`

### Environment Variables for Production

```bash
REACT_APP_GITHUB_CLIENT_ID=prod_client_id
REACT_APP_GITHUB_CLIENT_SECRET=prod_client_secret
REACT_APP_GITHUB_REDIRECT_URI=https://yourdomain.com/auth/github/callback
REACT_APP_BACKEND_URL=https://api.yourdomain.com

GITHUB_CLIENT_ID=prod_client_id
GITHUB_CLIENT_SECRET=prod_client_secret
GITHUB_CALLBACK_URL=https://yourdomain.com/auth/github/callback
```

## Development Mode (Without GitHub OAuth)

If you don't have GitHub OAuth set up yet, the app still works with mock authentication:

1. Leave `REACT_APP_GITHUB_CLIENT_ID` empty or unset
2. The app will use a mock token for development
3. Profile data will be simulated
4. This is useful for testing UI without actual GitHub credentials

## API Endpoints

The application uses these GitHub API endpoints:

- `GET https://api.github.com/user` - User profile information
- `GET https://api.github.com/user/emails` - User email addresses

## References

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app)
- [GitHub API - User Endpoint](https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user)
- [OAuth 2.0 Authorization Code Flow](https://tools.ietf.org/html/rfc6749#section-1.3.1)

## Support

If you encounter issues:
1. Check the application toast notifications (bottom-right corner)
2. Review browser console (F12) for JavaScript errors
3. Check backend logs for API errors
4. Verify all environment variables are set correctly
