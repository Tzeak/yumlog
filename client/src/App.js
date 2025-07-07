import React, { useState, useEffect } from "react";
import {
  Upload,
  Trash2,
  BarChart3,
  History,
  Image,
  LogOut,
  Settings,
  Key,
  Edit,
  Trash,
  User,
  Plus,
  Minus,
} from "lucide-react";
import axios from "axios";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  ClerkProvider,
  SignIn,
  useUser,
  useAuth,
  useClerk,
  useSignIn,
} from "@clerk/clerk-react";
import Yumdog from "./Yumdog";
import GoldiePortrait from "./GoldiePortrait";
import { useSwipeable } from "react-swipeable";
import { AnimatePresence, motion } from "framer-motion";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001/api";

// Create axios instance with auth interceptor
const api = axios.create({
  baseURL: API_BASE_URL,
});

const TABS = [
  { key: "upload", label: "Upload Photo", icon: Upload },
  { key: "history", label: "History", icon: History },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

function AppContent() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState("upload");
  const [showSettings, setShowSettings] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [meals, setMeals] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [note, setNote] = useState("");
  const [mealDescription, setMealDescription] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);

  // New state for editable ingredients
  const [editableIngredients, setEditableIngredients] = useState([]);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
  });

  // State for expanded meals in history
  const [expandedMeals, setExpandedMeals] = useState(new Set());

  // New state for ingredient editing
  const [ingredientEditText, setIngredientEditText] = useState("");
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [hasUnanalyzedChanges, setHasUnanalyzedChanges] = useState(false);

  // State for success message
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastSavedMeal, setLastSavedMeal] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(0); // -1 for left, 1 for right

  // Swipe handlers
  const tabIndex = TABS.findIndex((tab) => tab.key === activeTab);
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (tabIndex < TABS.length - 1) {
        setSwipeDirection(-1);
        setActiveTab(TABS[tabIndex + 1].key);
      }
    },
    onSwipedRight: () => {
      if (tabIndex > 0) {
        setSwipeDirection(1);
        setActiveTab(TABS[tabIndex - 1].key);
      }
    },
    trackMouse: true,
    delta: 40,
  });

  // Animated slide transition
  const getTabContent = () => {
    switch (activeTab) {
      case "upload":
        return renderUploadTab();
      case "history":
        return renderHistoryTab();
      case "analytics":
        return renderAnalyticsTab();
      default:
        return null;
    }
  };

  // Animation variants for sliding
  const variants = {
    enter: (direction) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  };

  // Key for AnimatePresence
  const pageKey = activeTab;

  // Add auth token to all requests
  useEffect(() => {
    // Only create interceptor if user is signed in
    if (!isSignedIn || !user) {
      return;
    }

    const interceptor = api.interceptors.request.use(async (config) => {
      try {
        console.log("🔐 Creating auth token for user:", user.id);

        // Get token without including getToken in dependencies
        const token = await getToken();
        if (token) {
          // For Clerk, we'll use the user ID and phone number as our token
          const phoneNumber =
            user?.primaryPhoneNumber?.phoneNumber ||
            user?.emailAddresses?.[0]?.emailAddress ||
            "unknown";
          const authToken = `${user.id}:${phoneNumber}`;
          config.headers.Authorization = `Bearer ${authToken}`;
          console.log(
            "🔑 Auth token created:",
            authToken.substring(0, 20) + "..."
          );
        }
      } catch (error) {
        console.error("Error getting auth token:", error);
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, [isSignedIn, user?.id]); // Only depend on isSignedIn and user ID

  // Clean up interceptor when user signs out
  useEffect(() => {
    if (!isSignedIn) {
      // Clear any existing interceptors
      api.interceptors.request.clear();
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn) {
      fetchMeals();
    }
  }, [isSignedIn]);

  const fetchMeals = async () => {
    try {
      console.log("📋 Fetching meals...");
      console.log("🔗 API URL:", API_BASE_URL);
      const response = await api.get("/meals");
      console.log("✅ Meals fetched successfully:", response.data);
      setMeals(response.data.meals || []);
    } catch (error) {
      console.error("❌ Error fetching meals:", error);
      console.error("📊 Error response:", error.response?.data);
      console.error("🔢 Error status:", error.response?.status);
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      setHasPhoto(true);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      // If no file selected, reset the input
      setSelectedImage(null);
      setImagePreview(null);
      setHasPhoto(false);
    }
  };

  const analyzeFood = async () => {
    if (!selectedImage && !mealDescription.trim()) return;

    setIsAnalyzing(true);
    try {
      let data;

      if (selectedImage) {
        // Photo-based analysis (with optional text description)
        const formData = new FormData();
        formData.append("image", selectedImage);
        if (mealDescription.trim()) {
          formData.append("note", mealDescription.trim());
        }

        data = await api.post("/analyze-food-only", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        // Text-only analysis
        data = await api.post("/analyze-text-only", {
          description: mealDescription.trim(),
        });
      }

      console.log("🔍 Analysis received:", data.data.analysis);
      console.log("🍽️ Foods array:", data.data.analysis.foods);

      setAnalysis(data.data.analysis);
      initializeEditableIngredients(data.data.analysis);
      // Don't fetch meals here since we haven't saved yet
    } catch (error) {
      console.error("Error analyzing food:", error);
      alert("Failed to analyze food. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteMeal = async (mealId) => {
    try {
      await api.delete(`/meals/${mealId}`);
      await fetchMeals();
    } catch (error) {
      console.error("Error deleting meal:", error);
    }
  };

  const resetUpload = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setAnalysis(null);
    setMealDescription("");
    setEditableIngredients([]);
    setIngredientEditText("");
    setIsReanalyzing(false);
    setHasUnanalyzedChanges(false);
    setHasPhoto(false);
    // Reset the file input
    const fileInput = document.getElementById("image-upload");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  // New functions for ingredient management
  const initializeEditableIngredients = (analysis) => {
    console.log(
      "🔧 Initializing editable ingredients from analysis:",
      analysis
    );
    if (analysis.foods && Array.isArray(analysis.foods)) {
      const ingredients = analysis.foods.map((food) => {
        // Use the servingMultiplier from the backend if available, otherwise default to 1
        const servingMultiplier = food.servingMultiplier || 1;

        // Calculate the total values (unit values × multiplier) for display
        const totalCalories = (food.calories || 0) * servingMultiplier;
        const totalProtein = (food.protein || 0) * servingMultiplier;
        const totalCarbs = (food.carbs || 0) * servingMultiplier;
        const totalFat = (food.fat || 0) * servingMultiplier;
        const totalFiber = (food.fiber || 0) * servingMultiplier;
        const totalSugar = (food.sugar || 0) * servingMultiplier;

        const ingredient = {
          ...food,
          id: Math.random().toString(36).substr(2, 9), // Generate unique ID
          originalQuantity: food.estimated_quantity,
          // Store the unit values as originals (for serving size calculations)
          originalCalories: food.calories || 0,
          originalProtein: food.protein || 0,
          originalCarbs: food.carbs || 0,
          originalFat: food.fat || 0,
          originalFiber: food.fiber || 0,
          originalSugar: food.sugar || 0,
          servingMultiplier: servingMultiplier,
          // Display the total values initially
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          fiber: totalFiber,
          sugar: totalSugar,
        };
        console.log("🍎 Processed ingredient:", ingredient);
        return ingredient;
      });
      console.log("📋 Setting editable ingredients:", ingredients);
      setEditableIngredients(ingredients);
    } else {
      console.log("❌ No foods array found in analysis or it's not an array");
    }
  };

  const updateIngredientServing = (ingredientId, multiplier) => {
    setEditableIngredients((prev) =>
      prev.map((ingredient) => {
        if (ingredient.id === ingredientId) {
          const newMultiplier = Math.max(0.1, multiplier); // Minimum 0.1x serving
          return {
            ...ingredient,
            servingMultiplier: newMultiplier,
            calories: Math.round(ingredient.originalCalories * newMultiplier),
            protein:
              Math.round(ingredient.originalProtein * newMultiplier * 10) / 10,
            carbs:
              Math.round(ingredient.originalCarbs * newMultiplier * 10) / 10,
            fat: Math.round(ingredient.originalFat * newMultiplier * 10) / 10,
            fiber:
              Math.round(ingredient.originalFiber * newMultiplier * 10) / 10,
            sugar:
              Math.round(ingredient.originalSugar * newMultiplier * 10) / 10,
          };
        }
        return ingredient;
      })
    );
    // Serving size adjustments are calculated locally and don't require reanalysis
  };

  const handleIngredientEdit = (text) => {
    setIngredientEditText(text);
    setHasUnanalyzedChanges(true);
  };

  const removeIngredient = (ingredientId) => {
    setEditableIngredients((prev) =>
      prev.filter((ingredient) => ingredient.id !== ingredientId)
    );
    // Removing ingredients is a local operation and doesn't require reanalysis
  };

  const getUpdatedTotals = () => {
    return editableIngredients.reduce(
      (totals, ingredient) => ({
        calories: totals.calories + (ingredient.calories || 0),
        protein: totals.protein + (ingredient.protein || 0),
        carbs: totals.carbs + (ingredient.carbs || 0),
        fat: totals.fat + (ingredient.fat || 0),
        fiber: totals.fiber + (ingredient.fiber || 0),
        sugar: totals.sugar + (ingredient.sugar || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
    );
  };

  const formatServingDisplay = (originalQuantity, servingMultiplier) => {
    // Handle undefined/null values for older meals
    if (!originalQuantity) {
      return servingMultiplier === 1
        ? "Unknown quantity"
        : `Unknown quantity × ${servingMultiplier.toFixed(1)}`;
    }

    if (servingMultiplier === 1) {
      return originalQuantity;
    }

    // Try to extract number and unit from the quantity
    const match = originalQuantity.match(/^([\d.]+)\s*(.+)$/);
    if (match) {
      const [, numberStr, unit] = match;
      const number = parseFloat(numberStr);
      if (!isNaN(number)) {
        const result = number * servingMultiplier;
        return `${originalQuantity} × ${servingMultiplier.toFixed(
          1
        )} = ${result.toFixed(1)} ${unit}`;
      }
    }

    // Fallback for complex quantities
    return `${originalQuantity} × ${servingMultiplier.toFixed(1)}`;
  };

  const saveMealWithModifications = async () => {
    if (!analysis || editableIngredients.length === 0) return;

    try {
      const totals = getUpdatedTotals();

      // Create updated analysis with modified ingredients
      const updatedAnalysis = {
        ...analysis,
        foods: editableIngredients,
        total_calories: totals.calories,
        total_protein: totals.protein,
        total_carbs: totals.carbs,
        total_fat: totals.fat,
        total_fiber: totals.fiber,
        total_sugar: totals.sugar,
      };

      let response;

      if (selectedImage) {
        // Photo-based meal (with optional text description)
        const formData = new FormData();
        formData.append("image", selectedImage);
        formData.append("analysis", JSON.stringify(updatedAnalysis));
        if (mealDescription.trim()) {
          formData.append("note", mealDescription.trim());
        }

        response = await api.post("/analyze-food", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        // Text-only meal
        response = await api.post("/analyze-text", {
          description: mealDescription.trim(),
          analysis: JSON.stringify(updatedAnalysis),
        });
      }

      // Store the saved meal details for success message
      const savedMeal = {
        id: response.data.mealId,
        analysis: updatedAnalysis,
        note: mealDescription.trim(),
        imagePath: selectedImage ? selectedImage.name : null,
        description: !selectedImage ? mealDescription.trim() : null,
        createdAt: new Date().toISOString(),
      };

      // Update the analysis state with the saved version
      setAnalysis(updatedAnalysis);
      await fetchMeals(); // Refresh meals list

      // Clear the upload section
      resetUpload();

      // Show success message
      setLastSavedMeal(savedMeal);
      setShowSuccessMessage(true);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
        setLastSavedMeal(null);
      }, 5000);
    } catch (error) {
      console.error("Error saving meal with modifications:", error);
      alert("Failed to save meal modifications. Please try again.");
    }
  };

  const getDailyStats = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayMeals = meals.filter(
      (meal) => format(new Date(meal.createdAt), "yyyy-MM-dd") === today
    );

    const stats = {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      mealCount: todayMeals.length,
    };

    todayMeals.forEach((meal) => {
      const analysis = meal.analysis;
      stats.totalCalories += analysis.total_calories || 0;
      stats.totalProtein += analysis.total_protein || 0;
      stats.totalCarbs += analysis.total_carbs || 0;
      stats.totalFat += analysis.total_fat || 0;
    });

    return stats;
  };

  const getMacroData = () => {
    const stats = getDailyStats();
    return [
      { name: "Protein", value: stats.totalProtein, color: "#667eea" },
      { name: "Carbs", value: stats.totalCarbs, color: "#764ba2" },
      { name: "Fat", value: stats.totalFat, color: "#f093fb" },
    ].filter((item) => item.value > 0);
  };

  const reanalyzeWithIngredients = async () => {
    if (
      !ingredientEditText.trim() ||
      (!selectedImage && !mealDescription.trim())
    )
      return;

    setIsReanalyzing(true);
    try {
      // Build comprehensive ingredient notes including serving adjustments
      let comprehensiveNotes = ingredientEditText.trim();

      // Add serving size adjustments to the notes only if there are text notes
      const servingAdjustments = editableIngredients
        .filter((ingredient) => ingredient.servingMultiplier !== 1)
        .map((ingredient) => {
          const originalQty = ingredient.originalQuantity;
          const multiplier = ingredient.servingMultiplier;
          const adjustedQty = formatServingDisplay(originalQty, multiplier);
          return `- ${
            ingredient.name
          }: adjusted from ${originalQty} to ${adjustedQty} (${multiplier.toFixed(
            1
          )}x serving)`;
        });

      if (servingAdjustments.length > 0) {
        comprehensiveNotes +=
          "\n\nServing size adjustments:\n" + servingAdjustments.join("\n");
      }

      let data;

      if (selectedImage) {
        // Photo-based reanalysis (with optional text description)
        const formData = new FormData();
        formData.append("image", selectedImage);
        formData.append("ingredient_notes", comprehensiveNotes);
        if (mealDescription.trim()) {
          formData.append("note", mealDescription.trim());
        }

        data = await api.post("/analyze-food-only", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        // Text-only reanalysis
        data = await api.post("/analyze-text-only", {
          description: mealDescription.trim(),
          note: comprehensiveNotes,
        });
      }

      console.log("🔍 Reanalysis received:", data.data.analysis);
      setAnalysis(data.data.analysis);
      initializeEditableIngredients(data.data.analysis);
      setIngredientEditText("");
      setHasUnanalyzedChanges(false);
      // Don't fetch meals here since we haven't saved yet
    } catch (error) {
      console.error("Error reanalyzing food:", error);
      alert("Failed to reanalyze food. Please try again.");
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Show loading state while Clerk is loading
  if (!isLoaded) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          color: "#667eea",
        }}
      >
        Loading...
      </div>
    );
  }

  // Show sign-in if not authenticated
  if (!isSignedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "40px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              marginBottom: "30px",
              color: "#333",
              fontSize: "28px",
            }}
          >
            🍎 Yumlog
          </h1>
          <p
            style={{
              marginBottom: "30px",
              color: "#666",
              lineHeight: "1.6",
            }}
          >
            log your yums. quick stats.
          </p>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <SignInWithPasskeyButton />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "#ddd" }}></div>
              <span
                style={{ margin: "0 16px", color: "#666", fontSize: "14px" }}
              >
                or
              </span>
              <div style={{ flex: 1, height: "1px", background: "#ddd" }}></div>
            </div>

            <button
              onClick={() => setShowSignInModal(true)}
              style={{
                padding: "12px 24px",
                background: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#5a6fd8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#667eea";
              }}
            >
              <User size={20} />
              Sign in with Phone Number
            </button>
          </div>
        </div>

        {/* Sign In Modal */}
        {showSignInModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
              padding: "20px",
            }}
            onClick={(e) => {
              // Close modal when clicking outside
              if (e.target === e.currentTarget) {
                setShowSignInModal(false);
              }
            }}
            onKeyDown={(e) => {
              // Close modal when pressing Escape
              if (e.key === "Escape") {
                setShowSignInModal(false);
              }
            }}
            tabIndex={0}
          >
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowSignInModal(false)}
                style={{
                  position: "absolute",
                  top: "-20px",
                  right: "-20px",
                  background: "rgba(255, 255, 255, 0.9)",
                  border: "none",
                  borderRadius: "50%",
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "20px",
                  color: "#666",
                  fontWeight: "bold",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  zIndex: 1001,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 1)";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                ×
              </button>
              <SignIn />
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderUploadTab = () => (
    <div className="card">
      <h2 style={{ marginBottom: "20px", textAlign: "center" }}>
        🍽️ Log Your Meal
      </h2>

      {/* Unified Input Section */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            border: "2px solid #e9ecef",
            borderRadius: "8px",
            background: "white",
            overflow: "hidden",
          }}
        >
          {/* Photo Upload Section */}
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              background: "#f8f9fa",
              borderBottom: "1px solid #e9ecef",
            }}
          >
            {!selectedImage ? (
              <div>
                <div
                  style={{
                    border: "2px dashed #667eea",
                    borderRadius: "8px",
                    padding: "30px",
                    marginBottom: "16px",
                    background: "white",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() =>
                    document.getElementById("image-upload").click()
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = "#764ba2";
                    e.currentTarget.style.background = "#f0f0f0";
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.borderColor = "#667eea";
                    e.currentTarget.style.background = "white";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith("image/")) {
                      setSelectedImage(file);
                      const reader = new FileReader();
                      reader.onload = (e) => setImagePreview(e.target.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                >
                  <Image
                    size={32}
                    style={{ marginBottom: "12px", color: "#667eea" }}
                  />
                  <p
                    style={{
                      fontSize: "16px",
                      marginBottom: "4px",
                      color: "#333",
                    }}
                  >
                    📸 Take a photo of your meal
                  </p>
                  <p style={{ fontSize: "14px", color: "#6c757d" }}>
                    Click to upload or drag & drop
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <img
                  src={imagePreview}
                  alt="Selected food"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "200px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    setHasPhoto(false);
                    // Reset the file input
                    const fileInput = document.getElementById("image-upload");
                    if (fileInput) {
                      fileInput.value = "";
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#dc3545",
                    border: "none",
                    color: "white",
                    margin: "0 auto",
                  }}
                >
                  <Trash2 size={16} />
                  Remove Photo
                </button>
              </div>
            )}
          </div>

          {/* OR Separator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "16px 20px",
              background: "white",
            }}
          >
            <div
              style={{ flex: 1, height: "1px", background: "#e9ecef" }}
            ></div>
            <div
              style={{
                padding: "0 16px",
                fontSize: "14px",
                fontWeight: "bold",
                color: "#6c757d",
                background: "white",
              }}
            >
              OR
            </div>
            <div
              style={{ flex: 1, height: "1px", background: "#e9ecef" }}
            ></div>
          </div>

          {/* Text Input Section */}
          <div style={{ padding: "20px" }}>
            <textarea
              value={mealDescription}
              onChange={(e) => setMealDescription(e.target.value)}
              placeholder="Describe what you ate. The more detail the better!"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e9ecef",
                borderRadius: "6px",
                fontSize: "16px",
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: "120px",
                outline: "none",
              }}
            />
            <p
              style={{
                fontSize: "14px",
                color: "#6c757d",
                marginTop: "8px",
                marginBottom: "0",
              }}
            >
              Be as detailed as possible for better macro calculations!
            </p>
          </div>
        </div>

        <input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: "none" }}
        />
      </div>

      {/* Action Buttons */}
      {(mealDescription.trim() || selectedImage) && (
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            className="btn btn-primary"
            onClick={analyzeFood}
            disabled={isAnalyzing}
            style={{ minWidth: "120px" }}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Food"}
          </button>

          <button
            className="btn btn-secondary"
            onClick={resetUpload}
            disabled={isAnalyzing}
          >
            Reset
          </button>
        </div>
      )}

      {/* Success Message */}
      {showSuccessMessage && lastSavedMeal && (
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
            borderRadius: "12px",
            color: "white",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(40, 167, 69, 0.3)",
          }}
        >
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "20px" }}>
            Meal Saved Successfully!
          </h3>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                  {lastSavedMeal.analysis.total_calories}
                </div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>Calories</div>
              </div>
              <div>
                <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                  {lastSavedMeal.analysis.total_protein}g
                </div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>Protein</div>
              </div>
              <div>
                <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                  {lastSavedMeal.analysis.total_carbs}g
                </div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>Carbs</div>
              </div>
              <div>
                <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                  {lastSavedMeal.analysis.total_fat}g
                </div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>Fat</div>
              </div>
            </div>
            {lastSavedMeal.description && (
              <div
                style={{ marginTop: "12px", fontSize: "14px", opacity: 0.9 }}
              >
                <strong>Description:</strong> {lastSavedMeal.description}
              </div>
            )}
            {lastSavedMeal.note && (
              <div
                style={{ marginTop: "12px", fontSize: "14px", opacity: 0.9 }}
              >
                <strong>Note:</strong> {lastSavedMeal.note}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setShowSuccessMessage(false);
              setLastSavedMeal(null);
            }}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "6px",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {analysis && (
        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "12px",
            border: "2px solid #667eea",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h3 style={{ color: "#333", margin: 0 }}>🍽️ Analysis Results</h3>
            <span
              style={{
                fontSize: "12px",
                color: "#6c757d",
                background: "#e9ecef",
                padding: "4px 8px",
                borderRadius: "4px",
              }}
            >
              {selectedImage ? "📸 Photo-based" : "📝 Text-based"}
            </span>
          </div>

          {/* Updated Totals Display */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            {(() => {
              const totals = getUpdatedTotals();
              return (
                <>
                  <div
                    style={{
                      textAlign: "center",
                      padding: "12px",
                      background: "white",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#667eea",
                      }}
                    >
                      {totals.calories}
                    </div>
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      Calories
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: "center",
                      padding: "12px",
                      background: "white",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#667eea",
                      }}
                    >
                      {totals.protein}g
                    </div>
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      Protein
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: "center",
                      padding: "12px",
                      background: "white",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#667eea",
                      }}
                    >
                      {totals.carbs}g
                    </div>
                    <div style={{ fontSize: "14px", color: "#666" }}>Carbs</div>
                  </div>

                  <div
                    style={{
                      textAlign: "center",
                      padding: "12px",
                      background: "white",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#667eea",
                      }}
                    >
                      {totals.fat}g
                    </div>
                    <div style={{ fontSize: "14px", color: "#666" }}>Fat</div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Yumlog Analysis Notes */}
          {analysis.notes && (
            <div
              style={{
                padding: "16px",
                background: "white",
                borderRadius: "8px",
                borderLeft: "4px solid #667eea",
                marginBottom: "20px",
              }}
            >
              <h4
                style={{
                  marginBottom: "8px",
                  color: "#333",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <GoldiePortrait size={62} /> Yumdog says:
              </h4>
              <p style={{ color: "#666", lineHeight: "1.6", margin: 0 }}>
                {analysis.notes}
              </p>
            </div>
          )}

          {/* Ingredients Breakdown */}
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ marginBottom: "16px", color: "#333" }}>
              📋 Ingredients Breakdown
            </h4>

            {editableIngredients.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#6c757d",
                  background: "white",
                  borderRadius: "8px",
                }}
              >
                No ingredients detected. Add some manually below.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {editableIngredients.map((ingredient) => (
                  <div
                    key={ingredient.id}
                    style={{
                      background: "white",
                      borderRadius: "8px",
                      padding: "16px",
                      border:
                        ingredient.confidence === "user_added"
                          ? "2px solid #28a745"
                          : "1px solid #e9ecef",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "4px",
                          }}
                        >
                          <h5
                            style={{
                              margin: 0,
                              color: "#333",
                              fontSize: "16px",
                            }}
                          >
                            {ingredient.name}
                          </h5>
                          {ingredient.confidence === "user_added" && (
                            <span
                              style={{
                                background: "#28a745",
                                color: "white",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: "bold",
                              }}
                            >
                              ADDED
                            </span>
                          )}
                          {ingredient.confidence === "low" && (
                            <span
                              style={{
                                background: "#ffc107",
                                color: "#333",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: "bold",
                              }}
                            >
                              LOW CONFIDENCE
                            </span>
                          )}
                        </div>
                        <p
                          style={{ margin: 0, color: "#666", fontSize: "14px" }}
                        >
                          {formatServingDisplay(
                            ingredient.originalQuantity,
                            ingredient.servingMultiplier
                          )}
                        </p>
                      </div>

                      <button
                        onClick={() => removeIngredient(ingredient.id)}
                        style={{
                          background: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        <Trash size={12} />
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(80px, 1fr))",
                        gap: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      <div
                        style={{
                          textAlign: "center",
                          padding: "8px",
                          background: "#f8f9fa",
                          borderRadius: "4px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: "bold",
                            color: "#667eea",
                          }}
                        >
                          {ingredient.calories}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          cal
                        </div>
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          padding: "8px",
                          background: "#f8f9fa",
                          borderRadius: "4px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: "bold",
                            color: "#667eea",
                          }}
                        >
                          {ingredient.protein}g
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          protein
                        </div>
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          padding: "8px",
                          background: "#f8f9fa",
                          borderRadius: "4px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: "bold",
                            color: "#667eea",
                          }}
                        >
                          {ingredient.carbs}g
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          carbs
                        </div>
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          padding: "8px",
                          background: "#f8f9fa",
                          borderRadius: "4px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: "bold",
                            color: "#667eea",
                          }}
                        >
                          {ingredient.fat}g
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          fat
                        </div>
                      </div>
                    </div>

                    {/* Serving Size Adjustment */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#666",
                          minWidth: "80px",
                        }}
                      >
                        Serving:
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          onClick={() =>
                            updateIngredientServing(
                              ingredient.id,
                              ingredient.servingMultiplier - 0.1
                            )
                          }
                          style={{
                            background: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            width: "32px",
                            height: "32px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0.1"
                          max="10"
                          defaultValue={ingredient.servingMultiplier.toFixed(1)}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value);
                            if (isNaN(value) || value < 0.1) {
                              updateIngredientServing(ingredient.id, 0.1);
                            } else if (value > 10) {
                              updateIngredientServing(ingredient.id, 10);
                            } else {
                              updateIngredientServing(ingredient.id, value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.target.blur();
                            }
                          }}
                          style={{
                            width: "60px",
                            textAlign: "center",
                            fontWeight: "bold",
                            fontSize: "16px",
                            border: "2px solid #e9ecef",
                            borderRadius: "4px",
                            padding: "4px 8px",
                            fontFamily: "inherit",
                          }}
                        />
                        <span
                          style={{
                            fontWeight: "bold",
                            fontSize: "16px",
                            color: "#666",
                          }}
                        >
                          x
                        </span>
                        <button
                          onClick={() =>
                            updateIngredientServing(
                              ingredient.id,
                              ingredient.servingMultiplier + 0.1
                            )
                          }
                          style={{
                            background: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            width: "32px",
                            height: "32px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Ingredient Form */}
          <div
            style={{
              background: "white",
              borderRadius: "8px",
              padding: "16px",
              border: "2px dashed #667eea",
              marginBottom: "20px",
            }}
          >
            <h4 style={{ marginBottom: "16px", color: "#333" }}>
              ✏️ Add or Edit Ingredients
            </h4>
            <p
              style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}
            >
              Describe what you want to add or change. For example: "Add 1
              tablespoon of olive oil", "Remove the rice and add quinoa
              instead", or "The chicken is actually 6oz not 4oz".
              <br />
              <br />
              <strong>Note:</strong> Serving size adjustments (using the +/-
              buttons) and removing ingredients (using the trash button) are
              calculated automatically and don't require reanalysis. Only add
              new ingredients or correct ingredient names here.
            </p>
            <div style={{ marginBottom: "16px" }}>
              <textarea
                value={ingredientEditText}
                onChange={(e) => handleIngredientEdit(e.target.value)}
                placeholder="Describe ingredients to add or changes to make..."
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #e9ecef",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  minHeight: "80px",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setIngredientEditText("");
                  setHasUnanalyzedChanges(false);
                }}
                className="btn btn-secondary"
                style={{ padding: "8px 16px", fontSize: "14px" }}
              >
                Cancel
              </button>
              <button
                onClick={reanalyzeWithIngredients}
                disabled={!ingredientEditText.trim() || isReanalyzing}
                className="btn btn-primary"
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  opacity:
                    !ingredientEditText.trim() || isReanalyzing ? 0.6 : 1,
                }}
              >
                {isReanalyzing ? "Reanalyzing..." : "Reanalyze"}
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              background: "white",
              borderRadius: "8px",
              border: "2px solid #28a745",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h4 style={{ margin: 0, color: "#333" }}>💾 Save Your Meal</h4>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  {hasUnanalyzedChanges
                    ? "Please reanalyze your ingredient changes before saving"
                    : "Save this meal with your ingredient modifications to your history"}
                </p>
              </div>
              <button
                onClick={saveMealWithModifications}
                disabled={hasUnanalyzedChanges}
                className="btn btn-primary"
                style={{
                  padding: "12px 24px",
                  fontSize: "16px",
                  background: hasUnanalyzedChanges ? "#6c757d" : "#28a745",
                  border: "none",
                  opacity: hasUnanalyzedChanges ? 0.6 : 1,
                  cursor: hasUnanalyzedChanges ? "not-allowed" : "pointer",
                }}
              >
                {hasUnanalyzedChanges ? "Save (Disabled)" : "Save Meal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => {
    const toggleMealExpansion = (mealId) => {
      const newExpanded = new Set(expandedMeals);
      if (newExpanded.has(mealId)) {
        newExpanded.delete(mealId);
      } else {
        newExpanded.add(mealId);
      }
      setExpandedMeals(newExpanded);
    };

    return (
      <div className="card">
        <h2 style={{ marginBottom: "20px" }}>📋 Meal History</h2>

        {meals.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "40px", color: "#6c757d" }}
          >
            <History size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
            <p>No meals recorded yet. Upload a photo to get started!</p>
          </div>
        ) : (
          <div className="meal-list">
            {meals.map((meal) => (
              <div key={meal.id} className="meal-item">
                <div className="meal-header">
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {meal.imagePath ? (
                      <img
                        src={`${API_BASE_URL.replace("/api", "")}/uploads/${
                          meal.imagePath
                        }`}
                        alt="Food"
                        className="meal-image"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "8px",
                          background:
                            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: "24px",
                          marginRight: "12px",
                        }}
                      >
                        📝
                      </div>
                    )}
                    <div className="meal-info">
                      <div className="meal-title">
                        {meal.analysis.meal_type || "Meal"}
                        {!meal.imagePath && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#6c757d",
                              marginLeft: "8px",
                              background: "#e9ecef",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            Text-based
                          </span>
                        )}
                      </div>
                      <div className="meal-time">
                        {format(new Date(meal.createdAt), "MMM dd, yyyy HH:mm")}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => toggleMealExpansion(meal.id)}
                      style={{ padding: "8px 12px", fontSize: "12px" }}
                    >
                      {expandedMeals.has(meal.id) ? "Hide" : "Show"} Ingredients
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => deleteMeal(meal.id)}
                      style={{ padding: "8px 12px" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {expandedMeals.has(meal.id) &&
                  meal.analysis.foods &&
                  meal.analysis.foods.length > 0 && (
                    <div
                      style={{
                        marginTop: "16px",
                        padding: "16px",
                        background: "#f8f9fa",
                        borderRadius: "8px",
                        border: "1px solid #e9ecef",
                      }}
                    >
                      <h4
                        style={{
                          marginBottom: "12px",
                          color: "#333",
                          fontSize: "16px",
                        }}
                      >
                        📋 Ingredients:
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {meal.analysis.foods.map((ingredient, index) => (
                          <div
                            key={index}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 12px",
                              background: "white",
                              borderRadius: "6px",
                              border:
                                ingredient.confidence === "user_added"
                                  ? "2px solid #28a745"
                                  : "1px solid #e9ecef",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  marginBottom: "2px",
                                }}
                              >
                                <span
                                  style={{ fontWeight: "bold", color: "#333" }}
                                >
                                  {ingredient.name}
                                </span>
                                {ingredient.confidence === "user_added" && (
                                  <span
                                    style={{
                                      background: "#28a745",
                                      color: "white",
                                      padding: "1px 4px",
                                      borderRadius: "3px",
                                      fontSize: "10px",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    ADDED
                                  </span>
                                )}
                                {ingredient.confidence === "low" && (
                                  <span
                                    style={{
                                      background: "#ffc107",
                                      color: "#333",
                                      padding: "1px 4px",
                                      borderRadius: "3px",
                                      fontSize: "10px",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    LOW
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "12px", color: "#666" }}>
                                {formatServingDisplay(
                                  ingredient.originalQuantity ||
                                    ingredient.estimated_quantity,
                                  ingredient.servingMultiplier || 1
                                )}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "12px",
                                fontSize: "12px",
                                color: "#666",
                              }}
                            >
                              <span>{ingredient.calories} cal</span>
                              <span>{ingredient.protein}g protein</span>
                              <span>{ingredient.carbs}g carbs</span>
                              <span>{ingredient.fat}g fat</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {meal.note && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      background: "#f8f9fa",
                      borderRadius: "6px",
                      fontSize: "14px",
                      color: "#6c757d",
                      borderLeft: "3px solid #667eea",
                    }}
                  >
                    <strong>Note:</strong> {meal.note}
                  </div>
                )}

                <div className="nutrition-grid">
                  <div className="nutrition-item">
                    <div className="nutrition-value">
                      {meal.analysis.total_calories}
                    </div>
                    <div className="nutrition-label">Calories</div>
                  </div>
                  <div className="nutrition-item">
                    <div className="nutrition-value">
                      {meal.analysis.total_protein}g
                    </div>
                    <div className="nutrition-label">Protein</div>
                  </div>
                  <div className="nutrition-item">
                    <div className="nutrition-value">
                      {meal.analysis.total_carbs}g
                    </div>
                    <div className="nutrition-label">Carbs</div>
                  </div>
                  <div className="nutrition-item">
                    <div className="nutrition-value">
                      {meal.analysis.total_fat}g
                    </div>
                    <div className="nutrition-label">Fat</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAnalyticsTab = () => {
    const stats = getDailyStats();
    const macroData = getMacroData();

    return (
      <div className="card">
        <h2 style={{ marginBottom: "20px" }}>📊 Daily Analytics</h2>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalCalories}</div>
            <div className="stat-label">Total Calories</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.mealCount}</div>
            <div className="stat-label">Meals Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalProtein}g</div>
            <div className="stat-label">Total Protein</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalCarbs}g</div>
            <div className="stat-label">Total Carbs</div>
          </div>
        </div>

        {macroData.length > 0 && (
          <div style={{ marginTop: "30px" }}>
            <h3 style={{ marginBottom: "20px", textAlign: "center" }}>
              Macronutrient Distribution
            </h3>
            <div style={{ height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {macroData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container">
      <div className="header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Yumdog size={48} />
              Yumlog
            </h1>
            <p>
              Upload a photo of your food and let Yumdog analyze your nutrition
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "#f8f9fa",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#666",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={() => setShowSettings(!showSettings)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#e9ecef";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f8f9fa";
              }}
            >
              <Settings size={16} />
              <span>{user?.primaryPhoneNumber?.phoneNumber || "User"}</span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => signOut()}
              style={{ padding: "8px 12px" }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content with swipeable and animated slide */}
      <div
        {...swipeHandlers}
        className={`swipeable-content tab-${activeTab}`}
        style={{ minHeight: "60vh" }}
      >
        <AnimatePresence initial={false} custom={swipeDirection} mode="wait">
          <motion.div
            key={pageKey}
            custom={swipeDirection}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.77, 0, 0.18, 1] }}
            style={{ width: "100%" }}
            onAnimationComplete={(definition) =>
              definition === "center" && setSwipeDirection(0)
            }
          >
            {getTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom tab bar */}
      <div className="tabs tabs-bottom">
        {TABS.map((tab, i) => (
          <div
            key={tab.key}
            className={`tab${activeTab === tab.key ? " active" : ""}`}
            onClick={() => {
              setSwipeDirection(i > tabIndex ? -1 : 1);
              setActiveTab(tab.key);
            }}
          >
            <tab.icon size={20} style={{ marginRight: "8px" }} />
            {tab.label}
          </div>
        ))}
        {/* Tab bar indicator will be styled in CSS */}
        <div
          className="tab-indicator"
          style={{
            left: `${(tabIndex / TABS.length) * 100}%`,
            width: `${100 / TABS.length}%`,
          }}
        />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "30px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ margin: 0, color: "#333" }}>⚙️ Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#666",
                  padding: "4px",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ marginBottom: "16px", color: "#333" }}>
                🔐 Passkey Management
              </h3>
              <p style={{ marginBottom: "20px", color: "#666" }}>
                Passkeys provide secure, passwordless authentication using your
                device's biometrics or PIN.
              </p>

              <div style={{ marginBottom: "20px" }}>
                <CreatePasskeyButton />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <SignInWithPasskeyButton />
              </div>
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: "20px" }}>
              <PasskeyList />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Passkey Management Components
function CreatePasskeyButton() {
  const { user } = useUser();

  const createClerkPasskey = async () => {
    if (!user) return;

    try {
      await user?.createPasskey();
    } catch (err) {
      console.error("Error:", JSON.stringify(err, null, 2));
    }
  };

  return (
    <button
      className="btn btn-primary"
      onClick={createClerkPasskey}
      style={{ marginBottom: "16px" }}
    >
      <Key size={16} style={{ marginRight: "8px" }} />
      Create a passkey
    </button>
  );
}

function SignInWithPasskeyButton() {
  const { signIn } = useSignIn();
  const { isSignedIn } = useUser();
  const { setActive } = useClerk();

  const signInWithPasskey = async () => {
    // Don't try to sign in if already signed in
    if (isSignedIn) {
      console.log("User is already signed in");
      return;
    }

    try {
      const signInAttempt = await signIn?.authenticateWithPasskey({
        flow: "discoverable",
      });

      if (signInAttempt?.status === "complete") {
        console.log("Passkey authentication successful");
        // Properly activate the session
        await setActive({ session: signInAttempt.createdSessionId });
      } else {
        console.log("Sign-in attempt status:", signInAttempt?.status);
      }
    } catch (err) {
      // Handle specific error cases
      if (err.errors && err.errors.some((e) => e.code === "session_exists")) {
        console.log(
          "User is already signed in - this is expected after successful authentication"
        );
        // Try to refresh the session
        try {
          await setActive();
        } catch (refreshError) {
          console.error("Error refreshing session:", refreshError);
        }
      } else {
        console.error(
          "Passkey authentication error:",
          JSON.stringify(err, null, 2)
        );
      }
    }
  };

  // Don't show the button if user is already signed in
  if (isSignedIn) {
    return null;
  }

  return (
    <button
      className="btn btn-primary"
      onClick={signInWithPasskey}
      style={{ marginBottom: "16px" }}
    >
      <Key size={16} style={{ marginRight: "8px" }} />
      Sign in with a passkey
    </button>
  );
}

function PasskeyList() {
  const { user } = useUser();
  const { passkeys } = user || {};
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState("");
  const [success, setSuccess] = useState("");

  const startEditing = (passkey) => {
    setEditingId(passkey.id);
    setNewName(passkey.name || "");
    setSuccess("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewName("");
    setSuccess("");
  };

  const saveEdit = async () => {
    try {
      const passkeyToUpdate = passkeys?.find((pk) => pk.id === editingId);
      await passkeyToUpdate?.update({ name: newName });
      setSuccess("Passkey renamed successfully!");
      setEditingId(null);
      setNewName("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error:", JSON.stringify(err, null, 2));
      setSuccess("Error renaming passkey");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const deletePasskey = async (passkeyId) => {
    try {
      const passkeyToDelete = passkeys?.find((pk) => pk.id === passkeyId);
      await passkeyToDelete?.delete();
      setSuccess("Passkey deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error:", JSON.stringify(err, null, 2));
      setSuccess("Error deleting passkey");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  if (!passkeys || passkeys.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "20px",
          color: "#666",
          background: "#f8f9fa",
          borderRadius: "8px",
        }}
      >
        <Key size={32} style={{ marginBottom: "8px", opacity: 0.5 }} />
        <p>No passkeys set up yet. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h4 style={{ marginBottom: "16px", color: "#333" }}>Your Passkeys</h4>

      {success && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: "16px",
            borderRadius: "6px",
            background: success.includes("Error") ? "#f8d7da" : "#d4edda",
            color: success.includes("Error") ? "#721c24" : "#155724",
            fontSize: "14px",
          }}
        >
          {success}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {passkeys?.map((pk) => (
          <div
            key={pk.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px",
              background: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #e9ecef",
            }}
          >
            <div style={{ flex: 1 }}>
              {editingId === pk.id ? (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                      fontSize: "14px",
                      flex: 1,
                    }}
                    placeholder="Enter passkey name"
                  />
                  <button
                    onClick={saveEdit}
                    style={{
                      padding: "6px 8px",
                      background: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    style={{
                      padding: "6px 8px",
                      background: "#6c757d",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "500",
                      color: "#333",
                      marginBottom: "4px",
                    }}
                  >
                    {pk.name || "Unnamed Passkey"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6c757d",
                    }}
                  >
                    ID: {pk.id}
                  </div>
                </div>
              )}
            </div>

            {editingId !== pk.id && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => startEditing(pk)}
                  style={{
                    padding: "6px 8px",
                    background: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                  }}
                >
                  <Edit size={12} />
                  Edit
                </button>
                <button
                  onClick={() => deletePasskey(pk.id)}
                  style={{
                    padding: "6px 8px",
                    background: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                  }}
                >
                  <Trash size={12} />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Main App component with ClerkProvider
function App() {
  const publishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

  // Add detailed logging for debugging
  console.log("🔍 Clerk Environment Debug Info:");
  console.log(
    "- REACT_APP_CLERK_PUBLISHABLE_KEY:",
    publishableKey ? `${publishableKey.substring(0, 20)}...` : "NOT SET"
  );
  console.log(
    "- All REACT_APP_ env vars:",
    Object.keys(process.env).filter((key) => key.startsWith("REACT_APP_"))
  );
  console.log("- Node environment:", process.env.NODE_ENV);
  console.log("- Current URL:", window.location.href);

  if (!publishableKey) {
    console.error("❌ Clerk publishable key is missing!");
    console.error("Environment variables available:", Object.keys(process.env));

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          color: "#667eea",
          flexDirection: "column",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: "20px" }}>🔑 Configuration Error</h2>
        <p style={{ marginBottom: "20px" }}>
          Clerk publishable key not found. Please check your environment
          variables.
        </p>
        <div
          style={{
            background: "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            fontSize: "14px",
            textAlign: "left",
            maxWidth: "600px",
          }}
        >
          <h4>Debug Information:</h4>
          <ul style={{ margin: "10px 0", paddingLeft: "20px" }}>
            <li>Environment: {process.env.NODE_ENV}</li>
            <li>URL: {window.location.href}</li>
            <li>
              REACT_APP_ variables:{" "}
              {Object.keys(process.env)
                .filter((key) => key.startsWith("REACT_APP_"))
                .join(", ") || "None found"}
            </li>
          </ul>
          <h4>How to fix:</h4>
          <ol style={{ margin: "10px 0", paddingLeft: "20px" }}>
            <li>
              Check if <code>.env</code> file exists in the client directory
            </li>
            <li>
              Verify <code>REACT_APP_CLERK_PUBLISHABLE_KEY</code> is set
              correctly
            </li>
            <li>
              Restart the development server after changing environment
              variables
            </li>
            <li>
              For production, ensure the environment variable is set in your
              hosting platform
            </li>
          </ol>
        </div>
      </div>
    );
  }

  // Validate the key format
  if (!publishableKey.startsWith("pk_")) {
    console.error("❌ Invalid Clerk publishable key format!");
    console.error('Key should start with "pk_test_" or "pk_live_"');

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          color: "#dc3545",
          flexDirection: "column",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: "20px" }}>🔑 Invalid Key Format</h2>
        <p style={{ marginBottom: "20px" }}>
          Clerk publishable key has invalid format. Key should start with
          "pk_test_" or "pk_live_".
        </p>
        <div
          style={{
            background: "#f8d7da",
            padding: "20px",
            borderRadius: "8px",
            fontSize: "14px",
            textAlign: "left",
            maxWidth: "600px",
          }}
        >
          <h4>Current key format:</h4>
          <code
            style={{
              background: "#fff",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            {publishableKey.substring(0, 20)}...
          </code>
          <h4 style={{ marginTop: "16px" }}>Expected format:</h4>
          <code
            style={{
              background: "#fff",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            pk_test_... or pk_live_...
          </code>
        </div>
      </div>
    );
  }

  console.log("✅ Clerk publishable key found and validated");

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <div className="App">
        <AppContent />
      </div>
    </ClerkProvider>
  );
}

export default App;
