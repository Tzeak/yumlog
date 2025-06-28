# 🍽️ yumlog

you eat food  
you take a picture  
yumlog guesses what it is and tells you what’s in it  

uses gpt-4 vision to analyze your meals  
built with node + react + sqlite  
all local, no cloud bloat

## what it does

- snap a photo of your food → get back estimated macros  
- logs everything locally, keeps a meal history  
- tracks your daily protein/carb/fat/sugar intake  
- drag and drop interface, works on your phone  
- runs offline (mostly), db is just a local sqlite file  
- no logins, no accounts, no bullshit

## getting started

you’ll need:

- node.js (v16+)
- npm or yarn
- an openai api key w/ image access

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

copy the example env and drop your openai key in

```bash
cp env.example .env
```

```env
OPENAI_API_KEY=sk-...
```

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

here’s what’s in `.env`:

```env
OPENAI_API_KEY=your key here
PORT=3001
NODE_ENV=development
DB_PATH=./data/yumlog.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

## how to use it

1. drag an image in or upload one  
2. click “analyze”  
3. wait for ai to figure out what you’re eating  

you’ll get back something like:

- calories
- macros (protein, carbs, fat, fiber, sugar)
- rough ingredient list
- vibes-based AI notes

every meal gets logged  
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
POST   /api/analyze-food     → send food image, get analysis  
GET    /api/meals            → get meal history  
DELETE /api/meals/:id        → delete a meal  
GET    /uploads/:filename    → serve image files  
```

## if shit breaks

### uploads not working?

- is it under 10mb?  
- is it a valid image file?  
- does `uploads/` have write perms?

### api errors?

- check if your key is right  
- check if you’ve got quota  
- check your model access

### sqlite won’t write?

- is `data/` folder writable?  
- try restarting the backend

## dev tips

- backend restarts: `npm run dev`  
- frontend hot reloads: `npm run client`  
- open devtools and network tab if things feel weird  
- logs go to console

## todo (maybe)

- auth / user profiles  
- better food parsing / ai prompt tuning  
- mobile app  
- export to csv  
- recipe gen  
- barcode scanner  
- social / share meals  
- sync with fitness stuff

## license

MIT lol use it or don’t

## credit

- openai for the image model  
- all the open source libs that do the real work  
- you, for trying to eat better probably

---

this is a personal project  
not medical advice  
don’t sue me if it thinks your tiramisu is beef stew
