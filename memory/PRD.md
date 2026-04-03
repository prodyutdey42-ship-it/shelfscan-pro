# ShelfScan AI - Product Requirements Document

## Original Problem Statement
Rebuild the ShelfScan AI app with:
1. Login with Gmail feature (Google OAuth)
2. History page showing previous uploads and tasks done

## Architecture

### Tech Stack
- **Frontend**: React.js with Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: Emergent-managed Google OAuth
- **AI Integration**: OpenAI GPT-4o Vision for shelf analysis

### Key Components
1. **Landing Page**: Hero with background, feature cards, Google login CTA
2. **Dashboard**: Stats cards, recent audits list, navigation
3. **New Audit**: Image upload, section name input, AI analysis
4. **Audit Results**: Compliance score, issues list, AI recommendations
5. **History Page**: Complete audit history with filters, summary stats

## User Personas
1. **Retail Store Manager**: Conducts shelf audits to ensure compliance
2. **FMCG Field Representative**: Audits multiple store locations
3. **Store Operations Team**: Reviews historical audit data for trends

## Core Requirements (Static)
- [x] AI-powered shelf image analysis
- [x] Compliance scoring (0-100)
- [x] Out-of-stock detection
- [x] Misplaced items detection
- [x] AI recommendations
- [x] Audit history tracking
- [x] User authentication (Google OAuth)

## What's Been Implemented

### January 3, 2026
- Complete rebuild of ShelfScan AI app
- Google OAuth authentication via Emergent Auth
- Protected routes (Dashboard, History, New Audit, Audit Results)
- Landing page with hero section and feature cards
- Dashboard with stats (Total Audits, Avg Score, This Week)
- History page with:
  - Summary cards (Total, Good, Warning, Critical)
  - Filter tabs (All, Critical, Warning, Good)
  - Sortable audit table
- New Audit page with image upload and AI analysis
- Audit Results page with compliance details
- MongoDB collections: users, user_sessions, audits

### April 3, 2026 - Auth Bug Fix
- Fixed 401 auth error after Google OAuth login
- Root cause: `useLocation().hash` from React Router doesn't reliably capture URL hash on OAuth redirect
- Solution: Changed `AppRouter` to use `window.location.hash` directly instead of React Router's `location.hash`
- AuthCallback component now properly triggers when `session_id` is in URL hash
- Improved error handling in AuthCallback - clears hash on error before redirecting

## Prioritized Backlog

### P0 (Critical)
- All implemented ✅

### P1 (Important)
- [ ] PDF report generation and download
- [ ] Camera capture (device camera integration)
- [ ] Audit comparison over time

### P2 (Nice to Have)
- [ ] Email notifications for critical audits
- [ ] Export audit data to CSV
- [ ] Multi-store management
- [ ] Team collaboration features

## Next Tasks
1. Implement PDF report download functionality
2. Add camera capture for mobile devices
3. Add audit comparison feature for trend analysis

## API Endpoints

### Auth
- `POST /api/auth/session` - Exchange session_id for user data
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Audits
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/audits` - List all user audits
- `GET /api/audits/{audit_id}` - Get specific audit
- `POST /api/audits/analyze` - Analyze shelf image
- `DELETE /api/audits/{audit_id}` - Delete audit

### History
- `GET /api/history` - Get complete audit history with summary

## Environment Variables

### Backend (.env)
- MONGO_URL
- DB_NAME
- CORS_ORIGINS
- EMERGENT_LLM_KEY

### Frontend (.env)
- REACT_APP_BACKEND_URL
