const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      "Analyze this food image and provide detailed nutritional information. Be as accurate as possible with portion sizes and nutritional values. If you're unsure about specific values, provide reasonable estimates and mark confidence as 'low'.";

    if (userDescription && userDescription.trim()) {
      userPrompt = `Analyze this food image with the following user description: ${userDescription.trim()}

Use this description to help identify ingredients and estimate portion sizes more accurately. Consider the user's description when analyzing the image and calculating nutritional values.

Provide detailed nutritional information. Be as accurate as possible with portion sizes and nutritional values. If you're unsure about specific values, provide reasonable estimates and mark confidence as 'low'.`;
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
            "You are a nutrition expert. Analyze food images and provide detailed nutritional information in a structured format.",
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
        return analysis;
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
        return analysis;
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

module.exports = {
  analyzeFoodImage,
  analyzeTextDescription,
};
