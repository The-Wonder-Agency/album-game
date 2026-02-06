# The All New All-New Album Game (AI Deluxe Edition)

A web-based album guessing game for teams, hosted on GitHub Pages.

## Features

- **Submit Albums**: Each team member can anonymously submit up to 2 albums per week
- **Guess**: Team members guess who submitted each album
- **Results**: View weekly results with correct/incorrect guesses and leaderboards
- **Stats**: Track overall performance and week-by-week statistics
- **Admin Panel**: Add and manage team members
- **Spotify Playlist**: Easy access to all submitted albums with Spotify links

## Setup for GitHub Pages

1. Push this repository to GitHub
2. Go to Settings > Pages in your GitHub repository
3. Select the branch (usually `main` or `master`) and folder (`/root`)
4. The site will be available at `https://[username].github.io/[repository-name]`

## Usage

### First Time Setup

1. Navigate to the **Admin** page
2. Default password is `admin` (you can change this in the code if needed)
3. Add all team members

### Weekly Workflow

1. **Friday**: The date automatically updates to show the current week
2. **Submit**: Team members submit up to 2 albums each
3. **Guess**: Team members guess who submitted each album
4. **Results**: View results after everyone has guessed
5. **Stats**: Check overall performance

## Data Storage

The app supports two storage modes:

### GitHub Gists with URL-Based Setup (Recommended for Teams)

**Easiest and most secure setup - only one person needs GitHub!**

1. **Admin** (with a GitHub account):
   - Creates a [GitHub Personal Access Token](https://github.com/settings/tokens) with `gist` scope
   - Logs into **Admin → Settings** in the app
   - Creates a new Gist (or uses existing)
   - Clicks "Copy URL" to get the share URL

2. **Share the URL** with your team members

3. **Team members** visit the share URL:
   - The app automatically configures itself
   - No GitHub account needed
   - No individual setup required
   - They can bookmark the app (URL parameters are cleared after setup)

**Benefits:**
- ✅ Only one person needs a GitHub account
- ✅ No tokens in source code (more secure)
- ✅ No individual configuration required
- ✅ All team members automatically share data
- ✅ Real-time sync across all users
- ✅ Easy to revoke (just change the token and share a new URL)

**Security Note:** The share URL contains your GitHub token. Only share it with trusted team members. If the token is compromised, revoke it on GitHub and create a new one.

### Individual Configuration (Alternative)

If you prefer individual setup:
1. Go to **Settings** page (admin only)
2. Each person creates their own GitHub token
3. Enter the shared Gist ID
4. More complex but gives individual control

### Local Storage (Fallback)
- Works without any setup
- Data is stored locally in each browser
- **Not shared** between team members
- Good for testing or single-user scenarios

## Notes

- The date shown is always the upcoming Friday (the week's game date)
- Submissions are anonymous until results are revealed
- Each person can submit 2 albums per week
- Guesses are saved automatically as you make them
- Duplicate albums (same artist + album) can be submitted by different people - users must guess which person submitted which one
