const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { analyzeFoodImage } = require('./services/openai');
const { initDatabase, saveMeal, getMeals, deleteMeal } = require('./services/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'food-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Initialize database
initDatabase();

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Yumlog API is running' });
});

// Upload and analyze food image
app.post('/api/analyze-food', upload.single('image'), async (req, res) => {
  try {
    console.log('🔍 Starting food analysis request...');
    
    if (!req.file) {
      console.log('❌ No image file provided');
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('📁 File received:', req.file.filename, 'Size:', req.file.size, 'bytes');
    const imagePath = req.file.path;
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.log('❌ OpenAI API key not configured');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please add your API key to the .env file.' 
      });
    }
    
    console.log('🤖 Calling OpenAI API...');
    // Analyze the image using OpenAI
    const analysis = await analyzeFoodImage(imagePath);
    console.log('✅ OpenAI analysis completed');
    
    // Get the note from request body, or use analysis notes if no note provided
    const userNote = req.body.note;
    let note = null;
    
    if (userNote && userNote.trim()) {
      // User provided a note, append GPT analysis notes if available
      if (analysis.notes && analysis.notes.trim()) {
        note = `${userNote.trim()}\n\nAI Analysis: ${analysis.notes.trim()}`;
      } else {
        note = userNote.trim();
      }
    } else if (analysis.notes && analysis.notes.trim()) {
      // No user note, use GPT analysis notes
      note = analysis.notes.trim();
    }
    
    // Save the meal to database
    console.log('💾 Saving meal to database...');
    const mealId = await saveMeal({
      imagePath: req.file.filename,
      analysis: analysis,
      note: note,
      timestamp: new Date().toISOString()
    });
    console.log('✅ Meal saved with ID:', mealId);

    res.json({
      success: true,
      mealId: mealId,
      analysis: analysis,
      note: note
    });

  } catch (error) {
    console.error('❌ Error analyzing food:', error);
    res.status(500).json({ 
      error: 'Failed to analyze food image',
      details: error.message 
    });
  }
});

// Get all meals
app.get('/api/meals', async (req, res) => {
  try {
    const meals = await getMeals();
    res.json({ meals });
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({ error: 'Failed to fetch meals' });
  }
});

// Delete a meal
app.delete('/api/meals/:id', async (req, res) => {
  try {
    const mealId = req.params.id;
    await deleteMeal(mealId);
    res.json({ success: true, message: 'Meal deleted successfully' });
  } catch (error) {
    console.error('Error deleting meal:', error);
    res.status(500).json({ error: 'Failed to delete meal' });
  }
});

// Serve uploaded images
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Yumlog server running on port ${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}/api`);
  console.log(`🔑 OpenAI API Key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
}); 