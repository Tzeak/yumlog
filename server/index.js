const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const {
  analyzeFoodImage,
  analyzeTextDescription,
  analyzeGoalProgress,
  analyzeTodayRecommendation,
} = require("./services/openai");
const {
  initDatabase,
  saveMeal,
  getMeals,
  deleteMeal,
  createOrUpdateUser,
  getUserById,
} = require("./services/database");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://yumlog.tzeak.com",
      "https://www.yumlog.tzeak.com",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.static("public"));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "food-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Initialize database
initDatabase();

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    console.log("🔐 Authentication attempt for:", req.path);
    console.log("📋 Headers:", req.headers);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ No authorization header or invalid format");
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.substring(7);
    console.log("🔑 Token received:", token.substring(0, 20) + "...");

    // For now, we'll use a simple token format: "user_id:phone_number"
    // In production, you should verify the token with Clerk's API
    const [userId, phoneNumber] = token.split(":");

    console.log("👤 User ID:", userId);
    console.log("📱 Phone/Email:", phoneNumber);

    if (!userId || !phoneNumber) {
      console.log("❌ Invalid token format - missing userId or phoneNumber");
      return res.status(401).json({ error: "Invalid token format" });
    }

    // Create or update user in database
    await createOrUpdateUser(userId, phoneNumber);

    // Add user info to request
    req.user = { id: userId, phoneNumber };
    console.log("✅ Authentication successful for user:", userId);
    next();
  } catch (error) {
    console.error("❌ Authentication error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
};

// Helper to log actions
function logAction({ phone, action, status }) {
  const timestamp = new Date().toISOString();
  const logLine = `${timestamp} ${phone || "unknown user"} just did ${action}${
    status ? ` [status: ${status}]` : ""
  }\n`;
  const logDir = path.join(__dirname, "../logs");
  const logFile = path.join(logDir, "actions.log");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
  fs.appendFileSync(logFile, logLine);
}

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Yumlog API is running" });
});

// Upload and analyze food image (without saving)
app.post(
  "/api/analyze-food-only",
  authenticateUser,
  upload.single("image"),
  async (req, res) => {
    try {
      console.log("🔍 Starting food analysis request (analysis only)...");

      if (!req.file) {
        console.log("❌ No image file provided");
        return res.status(400).json({ error: "No image file provided" });
      }

      console.log(
        "📁 File received:",
        req.file.filename,
        "Size:",
        req.file.size,
        "bytes"
      );
      const imagePath = req.file.path;

      let analysis;

      // Check if OpenAI API key is configured
      if (
        !process.env.OPENAI_API_KEY ||
        process.env.OPENAI_API_KEY === "your_openai_api_key_here"
      ) {
        console.log("❌ OpenAI API key not configured");
        return res.status(500).json({
          error:
            "OpenAI API key not configured. Please add your API key to the .env file.",
        });
      }

      console.log("🤖 Calling OpenAI API...");
      // Check if user description is provided for enhanced analysis
      const userDescription = req.body.note;
      const ingredientNotes = req.body.ingredient_notes;

      if (userDescription && userDescription.trim()) {
        console.log("📝 Analyzing with user description:", userDescription);
        analysis = await analyzeFoodImage(imagePath, null, userDescription);
      } else if (ingredientNotes && ingredientNotes.trim()) {
        console.log("📝 Reanalyzing with ingredient notes:", ingredientNotes);
        analysis = await analyzeFoodImage(imagePath, ingredientNotes);
      } else {
        // Analyze the image using OpenAI
        analysis = await analyzeFoodImage(imagePath);
      }
      console.log("✅ OpenAI analysis completed");

      res.json({
        success: true,
        analysis: analysis,
      });
    } catch (error) {
      console.error("❌ Error analyzing food:", error);
      res.status(500).json({
        error: "Failed to analyze food image",
        details: error.message,
      });
    }
  }
);

// Upload and analyze food image (with saving)
app.post(
  "/api/analyze-food",
  authenticateUser,
  upload.single("image"),
  async (req, res) => {
    try {
      console.log("🔍 Starting food analysis request with saving...");

      if (!req.file) {
        console.log("❌ No image file provided");
        return res.status(400).json({ error: "No image file provided" });
      }

      console.log(
        "📁 File received:",
        req.file.filename,
        "Size:",
        req.file.size,
        "bytes"
      );
      const imagePath = req.file.path;

      let analysis;

      // Check if analysis is provided in request body (for modified ingredients)
      if (req.body.analysis) {
        console.log("📝 Using provided analysis (modified ingredients)");
        try {
          analysis = JSON.parse(req.body.analysis);
        } catch (parseError) {
          console.error("❌ Failed to parse provided analysis:", parseError);
          return res
            .status(400)
            .json({ error: "Invalid analysis data provided" });
        }
      } else {
        // Check if OpenAI API key is configured
        if (
          !process.env.OPENAI_API_KEY ||
          process.env.OPENAI_API_KEY === "your_openai_api_key_here"
        ) {
          console.log("❌ OpenAI API key not configured");
          return res.status(500).json({
            error:
              "OpenAI API key not configured. Please add your API key to the .env file.",
          });
        }

        console.log("🤖 Calling OpenAI API...");
        // Check if user description is provided for enhanced analysis
        const userDescription = req.body.note;
        const ingredientNotes = req.body.ingredient_notes;

        if (userDescription && userDescription.trim()) {
          console.log("📝 Analyzing with user description:", userDescription);
          analysis = await analyzeFoodImage(imagePath, null, userDescription);
        } else if (ingredientNotes && ingredientNotes.trim()) {
          console.log("📝 Reanalyzing with ingredient notes:", ingredientNotes);
          analysis = await analyzeFoodImage(imagePath, ingredientNotes);
        } else {
          // Analyze the image using OpenAI
          analysis = await analyzeFoodImage(imagePath);
        }
        console.log("✅ OpenAI analysis completed");
      }

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
      console.log("💾 Saving meal to database...");
      const mealId = await saveMeal({
        userId: req.user.id,
        imagePath: req.file.filename,
        analysis: analysis,
        note: note,
        timestamp: new Date().toISOString(),
      });
      console.log("✅ Meal saved with ID:", mealId);

      res.json({
        success: true,
        mealId: mealId,
        analysis: analysis,
        note: note,
      });
    } catch (error) {
      console.error("❌ Error analyzing food:", error);
      res.status(500).json({
        error: "Failed to analyze food image",
        details: error.message,
      });
    }
  }
);

// Analyze text description (without saving)
app.post("/api/analyze-text-only", authenticateUser, async (req, res) => {
  try {
    console.log("🔍 Starting text analysis request (analysis only)...");

    const { description } = req.body;

    if (!description || !description.trim()) {
      console.log("❌ No description provided");
      return res.status(400).json({ error: "No description provided" });
    }

    console.log(
      "📝 Description received:",
      description.substring(0, 100) + "..."
    );

    let analysis;

    // Check if OpenAI API key is configured
    if (
      !process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY === "your_openai_api_key_here"
    ) {
      console.log("❌ OpenAI API key not configured");
      return res.status(500).json({
        error:
          "OpenAI API key not configured. Please add your API key to the .env file.",
      });
    }

    console.log("🤖 Calling OpenAI API for text analysis...");
    analysis = await analyzeTextDescription(description);
    console.log("✅ OpenAI text analysis completed");

    res.json({
      success: true,
      analysis: analysis,
    });
  } catch (error) {
    console.error("❌ Error analyzing text:", error);
    res.status(500).json({
      error: "Failed to analyze text description",
      details: error.message,
    });
  }
});

// Analyze text description (with saving)
app.post("/api/analyze-text", authenticateUser, async (req, res) => {
  try {
    console.log("🔍 Starting text analysis request with saving...");

    const { description, analysis: providedAnalysis } = req.body;

    if (!description || !description.trim()) {
      console.log("❌ No description provided");
      return res.status(400).json({ error: "No description provided" });
    }

    console.log(
      "📝 Description received:",
      description.substring(0, 100) + "..."
    );

    let analysis;

    // Check if analysis is provided in request body (for modified ingredients)
    if (providedAnalysis) {
      console.log("📝 Using provided analysis (modified ingredients)");
      try {
        analysis = JSON.parse(providedAnalysis);
      } catch (parseError) {
        console.error("❌ Failed to parse provided analysis:", parseError);
        return res
          .status(400)
          .json({ error: "Invalid analysis data provided" });
      }
    } else {
      // Check if OpenAI API key is configured
      if (
        !process.env.OPENAI_API_KEY ||
        process.env.OPENAI_API_KEY === "your_openai_api_key_here"
      ) {
        console.log("❌ OpenAI API key not configured");
        return res.status(500).json({
          error:
            "OpenAI API key not configured. Please add your API key to the .env file.",
        });
      }

      console.log("🤖 Calling OpenAI API for text analysis...");
      analysis = await analyzeTextDescription(description);
      console.log("✅ OpenAI text analysis completed");
    }

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

    // Save the meal to database (without image path)
    console.log("💾 Saving text-based meal to database...");
    const mealId = await saveMeal({
      userId: req.user.id,
      imagePath: null, // No image for text-based meals
      analysis: analysis,
      note: note,
      timestamp: new Date().toISOString(),
    });
    console.log("✅ Text-based meal saved with ID:", mealId);

    res.json({
      success: true,
      mealId: mealId,
      analysis: analysis,
      note: note,
    });
  } catch (error) {
    console.error("❌ Error analyzing text:", error);
    res.status(500).json({
      error: "Failed to analyze text description",
      details: error.message,
    });
  }
});

// Analyze goal progress
app.post("/api/analyze-goal", authenticateUser, async (req, res) => {
  try {
    console.log("🎯 Starting goal analysis request...");

    const { goal, meals } = req.body;

    if (!goal || !meals || !Array.isArray(meals)) {
      console.log("❌ Invalid goal or meals data provided");
      return res
        .status(400)
        .json({ error: "Invalid goal or meals data provided" });
    }

    console.log(`🎯 Analyzing ${meals.length} meals for ${goal} goal`);

    // Check if OpenAI API key is configured
    if (
      !process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY === "your_openai_api_key_here"
    ) {
      console.log("❌ OpenAI API key not configured");
      return res.status(500).json({
        error:
          "OpenAI API key not configured. Please add your API key to the .env file.",
      });
    }

    // Prepare meal data for analysis
    const mealData = meals.map((meal) => ({
      date: meal.createdAt,
      calories: meal.analysis.total_calories || 0,
      protein: meal.analysis.total_protein || 0,
      carbs: meal.analysis.total_carbs || 0,
      fat: meal.analysis.total_fat || 0,
      fiber: meal.analysis.total_fiber || 0,
      sugar: meal.analysis.total_sugar || 0,
      foods: meal.analysis.foods || [],
      note: meal.note || "",
    }));

    // Call the consolidated goal analysis function
    const result = await analyzeGoalProgress(
      goal,
      mealData,
      req.body.guidelines
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("❌ Error analyzing goal progress:", error);
    res.status(500).json({
      error: "Failed to analyze goal progress",
      details: error.message,
    });
  }
});

// Analyze today's recommendation
app.post("/api/analyze-today", authenticateUser, async (req, res) => {
  try {
    console.log("📅 Starting today's recommendation request...");

    const { goal, meals } = req.body;

    if (!goal || !meals || !Array.isArray(meals)) {
      console.log("❌ Invalid goal or meals data provided");
      return res
        .status(400)
        .json({ error: "Invalid goal or meals data provided" });
    }

    console.log(`📅 Analyzing today's meals for ${goal} goal`);

    // Check if OpenAI API key is configured
    if (
      !process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY === "your_openai_api_key_here"
    ) {
      console.log("❌ OpenAI API key not configured");
      return res.status(500).json({
        error:
          "OpenAI API key not configured. Please add your API key to the .env file.",
      });
    }

    // Prepare meal data for analysis
    const mealData = meals.map((meal) => ({
      date: meal.createdAt,
      calories: meal.analysis.total_calories || 0,
      protein: meal.analysis.total_protein || 0,
      carbs: meal.analysis.total_carbs || 0,
      fat: meal.analysis.total_fat || 0,
      fiber: meal.analysis.total_fiber || 0,
      sugar: meal.analysis.total_sugar || 0,
      foods: meal.analysis.foods || [],
      note: meal.note || "",
    }));

    // Call the consolidated today's recommendation function
    const result = await analyzeTodayRecommendation(
      goal,
      mealData,
      req.body.guidelines
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("❌ Error analyzing today's recommendation:", error);
    res.status(500).json({
      error: "Failed to analyze today's recommendation",
      details: error.message,
    });
  }
});

// Get all meals for authenticated user
app.get("/api/meals", authenticateUser, async (req, res) => {
  try {
    const meals = await getMeals(req.user.id);
    res.json({ meals });
  } catch (error) {
    console.error("Error fetching meals:", error);
    res.status(500).json({ error: "Failed to fetch meals" });
  }
});

// Delete a meal (only if owned by authenticated user)
app.delete("/api/meals/:id", authenticateUser, async (req, res) => {
  try {
    const mealId = req.params.id;
    await deleteMeal(mealId, req.user.id);
    res.json({ success: true, message: "Meal deleted successfully" });
  } catch (error) {
    console.error("Error deleting meal:", error);
    res.status(500).json({ error: "Failed to delete meal" });
  }
});

// Get user profile
app.get("/api/user/profile", authenticateUser, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    res.json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Serve uploaded images
app.get("/uploads/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "Image not found" });
  }
});

// Logging endpoint
app.post("/log-action", (req, res) => {
  const { phone, action, status } = req.body;
  try {
    logAction({ phone, action, status });
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to log action" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const phone =
    req.body?.phone ||
    req.user?.phoneNumber ||
    req.query?.phone ||
    "unknown user";
  const action = `API error at ${req.method} ${req.originalUrl}: ${err.message}`;
  logAction({ phone, action, status });
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Yumlog server running on port ${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}/api`);
  console.log(
    `🔑 OpenAI API Key configured: ${process.env.OPENAI_API_KEY ? "Yes" : "No"}`
  );
});

// Export logAction for use in error logging
module.exports = { app, logAction };
