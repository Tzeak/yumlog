# 🍽️ yumlog

you eat food  
you take a picture  
yumlog guesses what it is and tells you what's in it

uses gpt-4 vision to analyze your meals  
built with node + react + sqlite  
now with user authentication via Clerk.dev

## what it does

- describe your meal in text → get back estimated macros
- optionally add a photo for enhanced accuracy
- **smart serving size normalization** - automatically converts multiple units to single servings (e.g., "3 pieces" becomes "1 piece × 3.0 servings")
- logs everything locally, keeps a meal history
- tracks your daily protein/carb/fat/sugar intake
- drag and drop interface, works on your phone
- user authentication with phone numbers via Clerk.dev
- each user has their own private meal log
- runs offline (mostly), db is just a local sqlite file

## getting started

you'll need:

- node.js (v16+)
- npm or yarn
- an openai api key w/ image access
- a clerk.dev account for authentication

### install it

```bash
git clone <repo>
cd yumlog
```

```bash
npm install           # server deps
cd client && npm i    # client deps
cd ..
```

copy the example env and drop your keys in

```bash
cp env.example .env
```

```env
OPENAI_API_KEY=sk-...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### set up clerk.dev

1. Go to [clerk.dev](https://clerk.dev) and create an account
2. Create a new application
3. Enable phone number authentication
4. Copy your publishable key to the .env file
5. Configure your application settings as needed

**Quick setup:** Run `npm run setup-auth` and follow the prompts to automatically configure your Clerk key.

### run it

```bash
# terminal 1
npm run dev

# terminal 2
npm run client
```

open your browser:

- frontend: http://localhost:3000
- backend: http://localhost:3001

## env config

here's what's in `.env`:

```env
OPENAI_API_KEY=your key here
PORT=3001
NODE_ENV=development
DB_PATH=./data/yumlog.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key
REACT_APP_CLERK_PUBLISHABLE_KEY=your_clerk_key
```

## how to use it

1. sign in with your phone number
2. describe your meal in the text field (be detailed for better results!)
3. optionally add a photo for enhanced accuracy
4. click "analyze"
5. wait for ai to figure out what you're eating

you'll get back something like:

- calories
- macros (protein, carbs, fat, fiber, sugar)
- rough ingredient list
- vibes-based AI notes

every meal gets logged to your personal account  
go to the history tab to browse or delete stuff  
daily tab gives you graphs n stuff

## folders

```
server/
├── index.js               ← express app
├── services/
│   ├── openai.js          ← sends image to gpt
│   └── database.js        ← sqlite logic

client/
├── src/
│   ├── App.js             ← main react component
│   ├── index.js           ← entry point
│   └── index.css          ← styling
└── public/
    └── index.html         ← html template

uploads/                   ← where your meal pics go
```

## api

```
GET    /api/health           → is the server up
POST   /api/analyze-food     → send food image, get analysis (requires auth)
POST   /api/analyze-text     → send text description, get analysis (requires auth)
POST   /api/analyze-food-only → analyze image without saving (requires auth)
POST   /api/analyze-text-only → analyze text without saving (requires auth)
GET    /api/meals            → get meal history (requires auth)
DELETE /api/meals/:id        → delete a meal (requires auth)
GET    /api/user/profile     → get user profile (requires auth)
GET    /uploads/:filename    → serve image files
```

## authentication

The app now uses Clerk.dev for user authentication:

- Users sign in with their phone number
- Each user has their own private meal log
- Authentication is handled via JWT tokens
- User data is stored locally in SQLite

## if shit breaks

### uploads not working?

- is it under 10mb?
- is it a valid image file?
- does `uploads/` have write perms?

### api errors?

- check if your key is right
- check if you've got quota
- check your model access
- make sure you're signed in

### authentication issues?

- check if your Clerk key is correct
- verify Clerk application settings
- check browser console for auth errors

### sqlite won't write?

- is `data/` folder writable?
- try restarting the backend

## dev tips

- backend restarts: `npm run dev`
- frontend hot reloads: `npm run client`
- open devtools and network tab if things feel weird
- logs go to console
- check Clerk dashboard for auth logs

## todo (maybe)

- better food parsing / ai prompt tuning
- mobile app
- export to csv
- recipe gen
- barcode scanner
- social / share meals
- sync with fitness stuff
- email authentication option
- user profile customization

## license

MIT lol use it or don't

## credit

- openai for the image model
- clerk.dev for authentication
- all the open source libs that do the real work
- you, for trying to eat better probably

---

this is a personal project  
not medical advice  
don't sue me if it thinks your tiramisu is beef stew
