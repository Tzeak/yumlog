const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to normalize serving sizes to unit amounts
function normalizeServingSizes(analysis) {
  if (!analysis.foods || !Array.isArray(analysis.foods)) {
    return analysis;
  }

  const normalizedFoods = analysis.foods.map((food) => {
    const quantity = food.estimated_quantity;
    if (!quantity) return food;

    // Extract number and unit from quantity string
    const quantityMatch = quantity.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
    if (!quantityMatch) return food;

    const [, numberStr, unit] = quantityMatch;
    const number = parseFloat(numberStr);

    // If it's more than 1 unit, normalize to unit amount
    if (number > 1) {
      const servingMultiplier = number;

      // Create normalized food with unit serving
      const normalizedFood = {
        ...food,
        estimated_quantity: `1 ${unit}`,
        calories: Math.round((food.calories / servingMultiplier) * 100) / 100,
        protein: Math.round((food.protein / servingMultiplier) * 100) / 100,
        carbs: Math.round((food.carbs / servingMultiplier) * 100) / 100,
        fat: Math.round((food.fat / servingMultiplier) * 100) / 100,
        fiber: Math.round((food.fiber / servingMultiplier) * 100) / 100,
        sugar: Math.round((food.sugar / servingMultiplier) * 100) / 100,
        servingMultiplier: servingMultiplier,
      };

      return normalizedFood;
    }

    return food;
  });

  // Recalculate totals based on normalized foods
  const totalCalories = normalizedFoods.reduce((sum, food) => {
    const multiplier = food.servingMultiplier || 1;
    return sum + food.calories * multiplier;
  }, 0);

  const totalProtein = normalizedFoods.reduce((sum, food) => {
    const multiplier = food.servingMultiplier || 1;
    return sum + food.protein * multiplier;
  }, 0);

  const totalCarbs = normalizedFoods.reduce((sum, food) => {
    const multiplier = food.servingMultiplier || 1;
    return sum + food.carbs * multiplier;
  }, 0);

  const totalFat = normalizedFoods.reduce((sum, food) => {
    const multiplier = food.servingMultiplier || 1;
    return sum + food.fat * multiplier;
  }, 0);

  const totalFiber = normalizedFoods.reduce((sum, food) => {
    const multiplier = food.servingMultiplier || 1;
    return sum + food.fiber * multiplier;
  }, 0);

  const totalSugar = normalizedFoods.reduce((sum, food) => {
    const multiplier = food.servingMultiplier || 1;
    return sum + food.sugar * multiplier;
  }, 0);

  return {
    ...analysis,
    foods: normalizedFoods,
    total_calories: Math.round(totalCalories * 100) / 100,
    total_protein: Math.round(totalProtein * 100) / 100,
    total_carbs: Math.round(totalCarbs * 100) / 100,
    total_fat: Math.round(totalFat * 100) / 100,
    total_fiber: Math.round(totalFiber * 100) / 100,
    total_sugar: Math.round(totalSugar * 100) / 100,
  };
}

async function analyzeFoodImage(
  imagePath,
  ingredientNotes = null,
  userDescription = null
) {
  try {
    console.log("📖 Reading image file:", imagePath);
    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    console.log(
      "📊 Image size:",
      imageBuffer.length,
      "bytes, Base64 length:",
      base64Image.length
    );

    console.log("🤖 Making OpenAI API request with structured output...");

    let userPrompt =
      "You are an anthropomorphic dog. You are a nutrition expert. Analyze this food image and provide detailed nutritional information. Be as accurate as possible with portion sizes and nutritional values. If you're unsure about specific values, provide reasonable estimates and mark confidence as 'low'.";

    if (userDescription && userDescription.trim()) {
      userPrompt = `You are an anthropomorphic dog and nutrition expert.Analyze this food image with the following user description: ${userDescription.trim()}

Use this description to help identify ingredients and estimate portion sizes more accurately. Consider the user's description when analyzing the image and calculating nutritional values.

Provide detailed nutritional information. Be as accurate as possible with portion sizes and nutritional values. If you're unsure about specific values, provide reasonable estimates and mark confidence as 'low'. Respond as a dog would if it could talk. If there is no nutritional value, just bark.`;
    } else if (ingredientNotes && ingredientNotes.trim()) {
      userPrompt = `Please reanalyze this food image with the following additional information: ${ingredientNotes.trim()}

Consider this information when identifying ingredients and estimating nutritional values. If the user mentions specific ingredients, make sure to include them in your analysis. If they mention corrections to previous analysis, incorporate those corrections.

Provide detailed nutritional information. Be as accurate as possible with portion sizes and nutritional values. If you're unsure about specific values, provide reasonable estimates and mark confidence as 'low'.`;
    }

    const response = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      input: [
        {
          role: "system",
          content:
            "You are a nutrition expert and a dog. Analyze food images and provide detailed nutritional information in a structured format.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userPrompt,
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
      max_output_tokens: 1000,
      text: {
        format: {
          type: "json_schema",
          name: "nutrition_analysis",
          schema: {
            type: "object",
            properties: {
              foods: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Name of the food item",
                    },
                    estimated_quantity: {
                      type: "string",
                      description: "Estimated portion size",
                    },
                    calories: {
                      type: "number",
                      description: "Calories in the food item",
                    },
                    protein: {
                      type: "number",
                      description: "Protein content in grams",
                    },
                    carbs: {
                      type: "number",
                      description: "Carbohydrate content in grams",
                    },
                    fat: {
                      type: "number",
                      description: "Fat content in grams",
                    },
                    fiber: {
                      type: "number",
                      description: "Fiber content in grams",
                    },
                    sugar: {
                      type: "number",
                      description: "Sugar content in grams",
                    },
                    confidence: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                      description: "Confidence level in the analysis",
                    },
                  },
                  required: [
                    "name",
                    "estimated_quantity",
                    "calories",
                    "protein",
                    "carbs",
                    "fat",
                    "fiber",
                    "sugar",
                    "confidence",
                  ],
                  additionalProperties: false,
                },
              },
              total_calories: {
                type: "number",
                description: "Total calories for the entire meal",
              },
              total_protein: {
                type: "number",
                description: "Total protein content in grams",
              },
              total_carbs: {
                type: "number",
                description: "Total carbohydrate content in grams",
              },
              total_fat: {
                type: "number",
                description: "Total fat content in grams",
              },
              total_fiber: {
                type: "number",
                description: "Total fiber content in grams",
              },
              total_sugar: {
                type: "number",
                description: "Total sugar content in grams",
              },
              meal_type: {
                type: "string",
                enum: ["breakfast", "lunch", "dinner", "snack"],
                description: "Type of meal",
              },
              notes: {
                type: "string",
                description:
                  "Additional observations about the meal, but with levity, because you are a puppy. If there is no nutritional value, just bark",
              },
            },
            required: [
              "foods",
              "total_calories",
              "total_protein",
              "total_carbs",
              "total_fat",
              "total_fiber",
              "total_sugar",
              "meal_type",
              "notes",
            ],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    console.log("✅ OpenAI API response received");

    if (
      response.status === "incomplete" &&
      response.incomplete_details.reason === "max_output_tokens"
    ) {
      throw new Error("Incomplete response - max tokens exceeded");
    }

    const nutrition_analysis = response.output[0].content[0];

    if (nutrition_analysis.type === "refusal") {
      console.error(
        "❌ OpenAI refused the request:",
        nutrition_analysis.refusal
      );
      throw new Error(
        `OpenAI refused the request: ${nutrition_analysis.refusal}`
      );
    } else if (nutrition_analysis.type === "output_text") {
      console.log("✅ Structured JSON response received");
      console.log(
        "📝 Response content length:",
        nutrition_analysis.text.length
      );

      try {
        const analysis = JSON.parse(nutrition_analysis.text);
        console.log("✅ JSON parsed successfully");

        // Normalize serving sizes to unit amounts
        const normalizedAnalysis = normalizeServingSizes(analysis);
        console.log("✅ Serving sizes normalized");

        return normalizedAnalysis;
      } catch (parseError) {
        console.error(
          "❌ Failed to parse structured response as JSON:",
          parseError
        );
        console.log(
          "📄 Raw response:",
          nutrition_analysis.text.substring(0, 200) + "..."
        );
        throw new Error(
          `Failed to parse structured response: ${parseError.message}`
        );
      }
    } else {
      throw new Error("Unexpected response type from OpenAI");
    }
  } catch (error) {
    console.error("❌ OpenAI API error:", error);
    console.error("❌ Error details:", error.message);
    if (error.response) {
      console.error("❌ API Response error:", error.response.data);
    }
    throw new Error(`Failed to analyze image: ${error.message}`);
  }
}

async function analyzeTextDescription(description) {
  try {
    console.log("📝 Analyzing text description:", description);

    const response = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      input: [
        {
          role: "system",
          content:
            "You are a nutrition expert. Analyze text descriptions of meals and provide detailed nutritional information in a structured format. Be as accurate as possible with portion sizes and nutritional values based on the description provided.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Analyze this meal description and provide detailed nutritional information: ${description}

Be as accurate as possible with portion sizes and nutritional values. If you're unsure about specific values, provide reasonable estimates and mark confidence as 'low'. Consider typical serving sizes for the foods mentioned.`,
            },
          ],
        },
      ],
      max_output_tokens: 1000,
      text: {
        format: {
          type: "json_schema",
          name: "nutrition_analysis",
          schema: {
            type: "object",
            properties: {
              foods: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Name of the food item",
                    },
                    estimated_quantity: {
                      type: "string",
                      description: "Estimated portion size",
                    },
                    calories: {
                      type: "number",
                      description: "Calories in the food item",
                    },
                    protein: {
                      type: "number",
                      description: "Protein content in grams",
                    },
                    carbs: {
                      type: "number",
                      description: "Carbohydrate content in grams",
                    },
                    fat: {
                      type: "number",
                      description: "Fat content in grams",
                    },
                    fiber: {
                      type: "number",
                      description: "Fiber content in grams",
                    },
                    sugar: {
                      type: "number",
                      description: "Sugar content in grams",
                    },
                    confidence: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                      description: "Confidence level in the analysis",
                    },
                  },
                  required: [
                    "name",
                    "estimated_quantity",
                    "calories",
                    "protein",
                    "carbs",
                    "fat",
                    "fiber",
                    "sugar",
                    "confidence",
                  ],
                  additionalProperties: false,
                },
              },
              total_calories: {
                type: "number",
                description: "Total calories for the entire meal",
              },
              total_protein: {
                type: "number",
                description: "Total protein content in grams",
              },
              total_carbs: {
                type: "number",
                description: "Total carbohydrate content in grams",
              },
              total_fat: {
                type: "number",
                description: "Total fat content in grams",
              },
              total_fiber: {
                type: "number",
                description: "Total fiber content in grams",
              },
              total_sugar: {
                type: "number",
                description: "Total sugar content in grams",
              },
              meal_type: {
                type: "string",
                enum: ["breakfast", "lunch", "dinner", "snack"],
                description: "Type of meal",
              },
              notes: {
                type: "string",
                description: "Additional observations about the meal",
              },
            },
            required: [
              "foods",
              "total_calories",
              "total_protein",
              "total_carbs",
              "total_fat",
              "total_fiber",
              "total_sugar",
              "meal_type",
              "notes",
            ],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    console.log("✅ OpenAI API response received for text analysis");

    if (
      response.status === "incomplete" &&
      response.incomplete_details.reason === "max_output_tokens"
    ) {
      throw new Error("Incomplete response - max tokens exceeded");
    }

    const nutrition_analysis = response.output[0].content[0];

    if (nutrition_analysis.type === "refusal") {
      console.error(
        "❌ OpenAI refused the request:",
        nutrition_analysis.refusal
      );
      throw new Error(
        `OpenAI refused the request: ${nutrition_analysis.refusal}`
      );
    } else if (nutrition_analysis.type === "output_text") {
      console.log("✅ Structured JSON response received for text analysis");
      console.log(
        "📝 Response content length:",
        nutrition_analysis.text.length
      );

      try {
        const analysis = JSON.parse(nutrition_analysis.text);
        console.log("✅ JSON parsed successfully for text analysis");

        // Normalize serving sizes to unit amounts
        const normalizedAnalysis = normalizeServingSizes(analysis);
        console.log("✅ Serving sizes normalized for text analysis");

        return normalizedAnalysis;
      } catch (parseError) {
        console.error(
          "❌ Failed to parse structured response as JSON:",
          parseError
        );
        console.log(
          "📄 Raw response:",
          nutrition_analysis.text.substring(0, 200) + "..."
        );
        throw new Error(
          `Failed to parse structured response: ${parseError.message}`
        );
      }
    } else {
      throw new Error("Unexpected response type from OpenAI");
    }
  } catch (error) {
    console.error("❌ OpenAI API error for text analysis:", error);
    console.error("❌ Error details:", error.message);
    if (error.response) {
      console.error("❌ API Response error:", error.response.data);
    }
    throw new Error(`Failed to analyze text description: ${error.message}`);
  }
}

async function analyzeGoalProgress(goal, mealData, guidelines = null) {
  try {
    console.log("🎯 Starting goal analysis for:", goal);

    // Get recent meals (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentMeals = mealData.filter((meal) => {
      const mealDate = new Date(meal.date);
      return mealDate >= sevenDaysAgo;
    });

    const totalCalories = recentMeals.reduce(
      (sum, meal) => sum + meal.calories,
      0
    );
    const totalProtein = recentMeals.reduce(
      (sum, meal) => sum + meal.protein,
      0
    );
    const totalCarbs = recentMeals.reduce((sum, meal) => sum + meal.carbs, 0);
    const totalFat = recentMeals.reduce((sum, meal) => sum + meal.fat, 0);
    const totalFiber = recentMeals.reduce((sum, meal) => sum + meal.fiber, 0);
    const totalSugar = recentMeals.reduce((sum, meal) => sum + meal.sugar, 0);

    console.log("📊 Recent meal totals:", {
      meals: recentMeals.length,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      totalFiber,
      totalSugar,
    });

    // Calculate averages
    const avgCalories =
      recentMeals.length > 0 ? totalCalories / recentMeals.length : 0;
    const avgProtein =
      recentMeals.length > 0 ? totalProtein / recentMeals.length : 0;
    const avgCarbs =
      recentMeals.length > 0 ? totalCarbs / recentMeals.length : 0;
    const avgFat = recentMeals.length > 0 ? totalFat / recentMeals.length : 0;

    // Calculate macro percentages
    const totalMacros = totalProtein + totalCarbs + totalFat;
    const proteinPercent =
      totalMacros > 0 ? (totalProtein / totalMacros) * 100 : 0;
    const carbsPercent = totalMacros > 0 ? (totalCarbs / totalMacros) * 100 : 0;
    const fatPercent = totalMacros > 0 ? (totalFat / totalMacros) * 100 : 0;

    // Create analysis prompt based on goal
    let analysisPrompt = "";
    let goalGuidelines = "";

    if (goal === "keto") {
      goalGuidelines =
        guidelines ||
        `
Keto Diet Guidelines:
- Target macros: 70-80% fat, 20-25% protein, 5-10% carbs
- Daily carb limit: 20-50g net carbs
- Focus on high-fat foods, moderate protein, very low carbs
      `;

      analysisPrompt = `Analyze this user's recent meals for keto diet compliance:

Recent meals (${recentMeals.length} meals in last 7 days):
- Average calories: ${avgCalories.toFixed(0)}
- Average protein: ${avgProtein.toFixed(1)}g
- Average carbs: ${avgCarbs.toFixed(1)}g
- Average fat: ${avgFat.toFixed(1)}g
- Macro breakdown: ${proteinPercent.toFixed(
        1
      )}% protein, ${carbsPercent.toFixed(1)}% carbs, ${fatPercent.toFixed(
        1
      )}% fat

Recent meal details:
${recentMeals
  .map(
    (meal) =>
      `- ${new Date(meal.date).toLocaleDateString()}: ${meal.calories.toFixed(
        0
      )} cal, ${meal.protein.toFixed(1)}g protein, ${meal.carbs.toFixed(
        1
      )}g carbs, ${meal.fat.toFixed(1)}g fat${
        meal.note ? ` (Note: ${meal.note})` : ""
      }`
  )
  .join("\n")}

${goalGuidelines}

Provide a casual, conversational assessment that includes:

- Overall trend (improving, declining, or maintaining)
- 2-3 specific meals that were good keto choices and 2-3 meals that need improvement (reference the meal dates above)
- 3-4 actionable steps they can take to improve keto compliance
- Positive reinforcement for what they're doing well

Write like you're talking to a friend. Be specific about which meals were good/bad and why.`;
    } else if (goal === "antiInflammatory") {
      goalGuidelines =
        guidelines ||
        `
Anti-Inflammatory Diet Guidelines:
- Focus on whole, unprocessed foods
- Include: fatty fish, berries, leafy greens, nuts, olive oil
- Avoid: processed meats, refined carbs, added sugars, trans fats
- Limit: alcohol, fried foods, excessive red meat
- Emphasize: omega-3 rich foods, antioxidants, fiber
      `;

      analysisPrompt = `Analyze this user's recent meals for anti-inflammatory diet compliance:

Recent meals (${recentMeals.length} meals in last 7 days):
- Average calories: ${avgCalories.toFixed(0)}
- Average protein: ${avgProtein.toFixed(1)}g
- Average carbs: ${avgCarbs.toFixed(1)}g
- Average fat: ${avgFat.toFixed(1)}g
- Average fiber: ${totalFiber / recentMeals.length || 0}g
- Average sugar: ${totalSugar / recentMeals.length || 0}g

Recent meal details:
${recentMeals
  .map(
    (meal) =>
      `- ${new Date(meal.date).toLocaleDateString()}: ${meal.calories.toFixed(
        0
      )} cal, ${meal.protein.toFixed(1)}g protein, ${meal.carbs.toFixed(
        1
      )}g carbs, ${meal.fat.toFixed(1)}g fat${
        meal.note ? ` (Note: ${meal.note})` : ""
      }`
  )
  .join("\n")}

${goalGuidelines}

Provide a casual, conversational assessment that includes:

- Overall trend (improving, declining, or maintaining)
- 2-3 specific meals that were good anti-inflammatory choices and 2-3 meals that need improvement (reference the meal dates above)
- 3-4 actionable steps they can take to reduce inflammation
- Positive reinforcement for what they're doing well

Write like you're talking to a friend. Be specific about which meals were good/bad and why.`;
    }

    // Call OpenAI for goal analysis
    console.log("🤖 Calling OpenAI for goal analysis...");
    const response = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      input: [
        {
          role: "system",
          content:
            "You are a nutrition expert and a friendly dog. Analyze meal data for diet goal compliance and provide encouraging, actionable advice.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: analysisPrompt,
            },
          ],
        },
      ],
      max_output_tokens: 500,
      text: {
        format: {
          type: "json_schema",
          name: "goal_analysis",
          schema: {
            type: "object",
            properties: {
              trend: {
                type: "string",
                description:
                  "Brief assessment of current trend (1-2 sentences)",
              },
              recommendation: {
                type: "string",
                description:
                  "Specific, actionable recommendation to improve goal compliance (2-3 sentences)",
              },
            },
            required: ["trend", "recommendation"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    console.log("✅ OpenAI goal analysis completed");

    if (
      response.status === "incomplete" &&
      response.incomplete_details.reason === "max_output_tokens"
    ) {
      throw new Error("Incomplete response - max tokens exceeded");
    }

    const goal_analysis = response.output[0].content[0];

    if (goal_analysis.type === "refusal") {
      console.error("❌ OpenAI refused the request:", goal_analysis.refusal);
      throw new Error(`OpenAI refused the request: ${goal_analysis.refusal}`);
    } else if (goal_analysis.type === "output_text") {
      console.log("✅ Structured goal analysis received");

      try {
        const analysis = JSON.parse(goal_analysis.text);
        console.log("✅ Goal analysis JSON parsed successfully");

        return {
          analysis: analysis,
          stats: {
            recentMeals: recentMeals.length,
            avgCalories,
            avgProtein,
            avgCarbs,
            avgFat,
            proteinPercent,
            carbsPercent,
            fatPercent,
          },
          relevantMeals: recentMeals,
        };
      } catch (parseError) {
        console.error("❌ Failed to parse goal analysis as JSON:", parseError);
        throw new Error(`Failed to parse goal analysis: ${parseError.message}`);
      }
    } else {
      throw new Error("Unexpected response type from OpenAI");
    }
  } catch (error) {
    console.error("❌ Error analyzing goal progress:", error);
    throw new Error(`Failed to analyze goal progress: ${error.message}`);
  }
}

async function analyzeTodayRecommendation(goal, mealData, guidelines = null) {
  try {
    console.log("📅 Starting today's recommendation analysis for:", goal);

    // Get today's meals
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const todayEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    const todayMeals = mealData.filter((meal) => {
      const mealDate = new Date(meal.date);
      return mealDate >= todayStart && mealDate < todayEnd;
    });

    const totalCalories = todayMeals.reduce(
      (sum, meal) => sum + meal.calories,
      0
    );
    const totalProtein = todayMeals.reduce(
      (sum, meal) => sum + meal.protein,
      0
    );
    const totalCarbs = todayMeals.reduce((sum, meal) => sum + meal.carbs, 0);
    const totalFat = todayMeals.reduce((sum, meal) => sum + meal.fat, 0);
    const totalFiber = todayMeals.reduce((sum, meal) => sum + meal.fiber, 0);
    const totalSugar = todayMeals.reduce((sum, meal) => sum + meal.sugar, 0);

    console.log("📊 Today's totals:", {
      meals: todayMeals.length,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      totalFiber,
      totalSugar,
    });

    // Create today-specific analysis prompt
    let analysisPrompt = "";
    let goalGuidelines = "";

    if (goal === "keto") {
      goalGuidelines =
        guidelines ||
        `
Keto Diet Guidelines:
- Target macros: 70-80% fat, 20-25% protein, 5-10% carbs
- Daily carb limit: 20-50g net carbs
- Focus on high-fat foods, moderate protein, very low carbs
      `;

      analysisPrompt = `Analyze this user's meals for TODAY and provide specific advice for the rest of the day:

Today's meals so far (${todayMeals.length} meals):
- Total calories: ${totalCalories.toFixed(0)}
- Total protein: ${totalProtein.toFixed(1)}g
- Total carbs: ${totalCarbs.toFixed(1)}g
- Total fat: ${totalFat.toFixed(1)}g
- Total fiber: ${totalFiber.toFixed(1)}g
- Total sugar: ${totalSugar.toFixed(1)}g

Today's meal details:
${todayMeals
  .map(
    (meal) =>
      `- ${new Date(meal.date).toLocaleTimeString()}: ${meal.calories.toFixed(
        0
      )} cal, ${meal.protein.toFixed(1)}g protein, ${meal.carbs.toFixed(
        1
      )}g carbs, ${meal.fat.toFixed(1)}g fat${
        meal.note ? ` (Note: ${meal.note})` : ""
      }`
  )
  .join("\n")}

${goalGuidelines}

Provide a casual, conversational recommendation that includes how they're doing so far today, 2-3 specific foods/meals they should eat for the rest of today, what they should avoid for the rest of today, and why these suggestions will help them stay on track.

Write like you're talking to a friend. Keep it short and concise. Don't use markdown formatting.`;
    } else if (goal === "antiInflammatory") {
      goalGuidelines =
        guidelines ||
        `
Anti-Inflammatory Diet Guidelines:
- Focus on whole, unprocessed foods
- Include: fatty fish, berries, leafy greens, nuts, olive oil
- Avoid: processed meats, refined carbs, added sugars, trans fats
- Limit: alcohol, fried foods, excessive red meat
- Emphasize: omega-3 rich foods, antioxidants, fiber
      `;

      analysisPrompt = `Analyze this user's meals for TODAY and provide specific advice for reducing inflammation:

Today's meals so far (${todayMeals.length} meals):
- Total calories: ${totalCalories.toFixed(0)}
- Total protein: ${totalProtein.toFixed(1)}g
- Total carbs: ${totalCarbs.toFixed(1)}g
- Total fat: ${totalFat.toFixed(1)}g
- Total fiber: ${totalFiber.toFixed(1)}g
- Total sugar: ${totalSugar.toFixed(1)}g

Today's meal details:
${todayMeals
  .map(
    (meal) =>
      `- ${new Date(meal.date).toLocaleTimeString()}: ${meal.calories.toFixed(
        0
      )} cal, ${meal.protein.toFixed(1)}g protein, ${meal.carbs.toFixed(
        1
      )}g carbs, ${meal.fat.toFixed(1)}g fat${
        meal.note ? ` (Note: ${meal.note})` : ""
      }`
  )
  .join("\n")}

${goalGuidelines}

Provide a casual, conversational recommendation that includes:

- How they're doing so far today for reducing inflammation
- 2-3 specific anti-inflammatory foods/meals they should eat for the rest of today 
- What inflammatory foods they should avoid for the rest of today
- Why these suggestions will help reduce inflammation

Write like you're talking to a friend. Keep it short and concise. Don't use markdown formatting.`;
    }

    // Call OpenAI for today's recommendation
    console.log("🤖 Calling OpenAI for today's recommendation...");
    const response = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      input: [
        {
          role: "system",
          content:
            "You are a nutrition expert and a friendly dog. Provide specific, actionable advice for what to eat for the rest of today based on what they've already eaten.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: analysisPrompt,
            },
          ],
        },
      ],
      max_output_tokens: 300,
      text: {
        format: {
          type: "json_schema",
          name: "today_recommendation",
          schema: {
            type: "object",
            properties: {
              recommendation: {
                type: "string",
                description:
                  "Formatted recommendation with sections separated by line breaks.",
              },
            },
            required: ["recommendation"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    console.log("✅ OpenAI today's recommendation completed");

    if (
      response.status === "incomplete" &&
      response.incomplete_details.reason === "max_output_tokens"
    ) {
      throw new Error("Incomplete response - max tokens exceeded");
    }

    const today_recommendation = response.output[0].content[0];

    if (today_recommendation.type === "refusal") {
      console.error(
        "❌ OpenAI refused the request:",
        today_recommendation.refusal
      );
      throw new Error(
        `OpenAI refused the request: ${today_recommendation.refusal}`
      );
    } else if (today_recommendation.type === "output_text") {
      console.log("✅ Structured today's recommendation received");

      try {
        const recommendation = JSON.parse(today_recommendation.text);
        console.log("✅ Today's recommendation JSON parsed successfully");

        return {
          recommendation: recommendation.recommendation,
          todayStats: {
            meals: todayMeals.length,
            totalCalories,
            totalProtein,
            totalCarbs,
            totalFat,
            totalFiber,
            totalSugar,
          },
        };
      } catch (parseError) {
        console.error(
          "❌ Failed to parse today's recommendation as JSON:",
          parseError
        );
        throw new Error(
          `Failed to parse today's recommendation: ${parseError.message}`
        );
      }
    } else {
      throw new Error("Unexpected response type from OpenAI");
    }
  } catch (error) {
    console.error("❌ Error analyzing today's recommendation:", error);
    throw new Error(
      `Failed to analyze today's recommendation: ${error.message}`
    );
  }
}

module.exports = {
  analyzeFoodImage,
  analyzeTextDescription,
  normalizeServingSizes,
  analyzeGoalProgress,
  analyzeTodayRecommendation,
};
