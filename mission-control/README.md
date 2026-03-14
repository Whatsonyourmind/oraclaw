# MISSION CONTROL - Setup & Development Guide

## 🚀 ZERO-BUDGET STACK

### FREE API SERVICES (Already Configured)
- **Google Gemini API**: 15 requests/minute free tier
- **Supabase**: 500MB DB + 50MB storage + pgvector
- **Expo**: Free tier for development
- **Rate Limiting**: Built-in protection to stay within free limits

## 📋 QUICK SETUP

### 1. Environment Configuration
```bash
# Copy the environment template
cp apps/api/.env.example apps/api/.env

# Add your free API keys:
# - Google Gemini: https://makersuite.google.com/app/apikey
# - Supabase: https://supabase.com (create new project)
```

### 2. Install Dependencies
```bash
# From project root
npm install

# Install mobile dependencies
cd apps/mobile && npm install

# Install API dependencies  
cd ../api && npm install
```

### 3. Database Setup
1. Create Supabase project (free tier)
2. Run the SQL from `apps/api/database/schema.sql` in Supabase SQL Editor
3. Enable Row Level Security (included in schema)
4. Create storage bucket "mission-files"

### 4. Start Development Servers
```bash
# Terminal 1: Start API server
cd apps/api
npm run dev

# Terminal 2: Start Expo mobile app
cd apps/mobile  
npx expo start
```

## 📱 APP FEATURES (MVP READY)

### ✅ Core WOW Moments Implemented
1. **Intel Overlay** - Camera → Real-time field extraction + confidence scoring
2. **Briefing Generation** - 40-second cinematic briefings with priorities
3. **Meeting Debrief** - Audio analysis → decisions + follow-ups + drafts
4. **Smart Actions** - One-tap task/event creation from extracted intel

### 🎯 FREE TIER OPTIMIZATIONS
- **Rate Limiting**: 100 req/min with automatic retries
- **Offline Queue**: Actions saved when offline, synced when online
- **Image Compression**: Auto-resize to 1024px for faster processing
- **Smart Caching**: Briefings cached for 24 hours
- **Fallback UI**: Works even when APIs are down

## 🏗️ PROJECT STRUCTURE

```
mission-control/
├── apps/
│   ├── mobile/                 # Expo React Native app
│   │   ├── src/features/       # Camera, Intel, Briefing, Debrief
│   │   ├── src/store/          # Zustand state management
│   │   └── app.json            # Expo configuration
│   └── api/                    # Node.js Fastify backend
│       ├── src/services/       # Gemini AI, Supabase DB
│       └── database/           # PostgreSQL schema
├── packages/
│   ├── shared-types/            # TypeScript interfaces
│   └── client-sdk/             # API client with offline support
└── package.json                # Monorepo configuration
```

## 🔧 KEY INTEGRATIONS

### Camera → Intel Flow
1. `CameraCapture` takes photo
2. Image compressed and uploaded to Supabase storage  
3. Gemini Vision API extracts fields, risks, entities
4. `IntelOverlay` shows results with confidence scores
5. User selects actions → creates tasks/events

### Briefing Flow
1. User requests briefing from calendar/tasks
2. Gemini Pro analyzes priorities + time windows
3. `BriefingScreen` shows cinematic 40s presentation
4. User accepts actions → synced to mission system

### Meeting Debrief Flow
1. Audio recorded and uploaded
2. Gemini Pro analyzes transcript for decisions
3. `MeetingDebrief` shows decisions + follow-ups
4. One-tap create emails/tasks from analysis

## 🎨 UI COMPONENTS

### Spy-Themed Design
- **Color**: Matrix green (#00FF88) on black background
- **Typography**: SF Pro Display + monospace for mission IDs
- **Micro-interactions**: Haptic feedback, scan lines, pulse animations
- **Cinematic effects**: Fade-ins, spring animations, progress rings

### Key Screens
- **Command Center**: Active missions + quick actions
- **Intel Capture**: Camera with scanning overlay
- **Briefing**: Countdown timer + priority badges
- **Debrief**: Audio player + decision cards
- **Dossier**: Saved intelligence search

## 📊 FREE TIER LIMITS

### Google Gemini
- **15 requests/minute** → Built-in rate limiting
- **15 requests/day** for Pro Vision → Smart fallback to text-only
- **30 characters/second** for streaming → Progressive rendering

### Supabase  
- **500MB database** → Optimized schema + regular cleanup
- **50MB file storage** → Image compression + size limits
- **2GB bandwidth/month** → Caching + offline mode

### Expo
- **Unlimited development** → No cost during build
- **100MB app size** → Optimized assets + lazy loading

## 🚀 DEPLOYMENT

### Local Development
1. API runs on `http://localhost:3001`
2. Expo app connects via local IP (update `EXPO_PUBLIC_API_URL`)
3. Supabase handles remote data persistence

### Production (Free Options)
- **Backend**: Railway.app (free tier) or Vercel
- **Mobile**: TestFlight/Play Store (free publishing)
- **Database**: Supabase free tier (production ready)

## 🔍 TESTING THE APP

### Manual Testing Flow
1. Open app → Grant camera permission
2. Take photo of document → See Intel overlay
3. Create actions → Check they appear in mission
4. Generate briefing → Review 40s presentation
5. Record meeting → Analyze for decisions

### API Testing
```bash
# Health check
curl http://localhost:3001/health

# Test briefing generation
curl -X POST http://localhost:3001/api/briefing \
  -H "Content-Type: application/json" \
  -d '{"priorities": ["urgent", "meetings"]}'
```

## 🛠️ TROUBLESHOOTING

### Common Issues
- **Camera permission**: Clear app data or reset permissions
- **API rate limits**: Wait 60 seconds after hitting limits
- **Image upload failures**: Check image size <50MB
- **Supabase connection**: Verify URL and keys in .env
- **Expo build errors**: Clear node_modules and reinstall

### Free Tier Optimization
- Images auto-compressed to stay under storage limits
- Requests queued when rate limited
- Offline mode when network unavailable
- Cached results reduce API calls

## 📈 METRICS TO TRACK

### User Engagement
- **WOW Rate**: % users triggering 2+ WOW moments in 24h
- **Activation**: % completing first mission
- **Retention**: % returning within 7 days

### Technical Performance
- **API Response Time**: <3s for extractions
- **Offline Recovery**: % queued actions synced
- **Error Rate**: <5% failed requests

This gives you a fully functional MISSION CONTROL app that works entirely with free services. The core WOW moments are implemented with proper rate limiting, offline support, and fallbacks to ensure smooth operation within free tier constraints.