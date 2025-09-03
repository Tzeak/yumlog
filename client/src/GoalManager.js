import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash, Save, X, Target } from "lucide-react";
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth interceptor
api.interceptors.request.use(async (config) => {
  try {
    // Get user info from Clerk
    const user = window.Clerk?.user;
    if (user) {
      // Create token in the same format as App.js
      const phoneNumber =
        user?.primaryPhoneNumber?.phoneNumber ||
        user?.emailAddresses?.[0]?.emailAddress ||
        "unknown";
      const authToken = `${user.id}:${phoneNumber}`;
      config.headers.Authorization = `Bearer ${authToken}`;
    }
  } catch (error) {
    console.error("Error getting auth token:", error);
  }
  return config;
});

const GoalManager = ({ onGoalSelect, selectedGoalId }) => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    guidelines: "",
    evaluationCriteria: "",
    targets: {
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
    },
  });
  const [goalDescription, setGoalDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGeneratedForm, setShowGeneratedForm] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const response = await api.get("/goals");
      setGoals(response.data.goals || []);
    } catch (error) {
      console.error("Error fetching goals:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateGoalGuidelines = async () => {
    if (!goalDescription.trim()) {
      alert("Please enter a goal description");
      return;
    }

    try {
      setIsGenerating(true);
      const response = await api.post("/generate-goal", {
        goalDescription: goalDescription.trim(),
      });

      if (response.data.success && response.data.goal) {
        setFormData({
          name: response.data.goal.name,
          description: response.data.goal.description,
          guidelines: response.data.goal.guidelines,
          evaluationCriteria: response.data.goal.evaluationCriteria,
          targets: response.data.goal.targets || {
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
          },
        });
        setShowGeneratedForm(true);
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error("Error generating goal guidelines:", error);
      alert("Failed to generate goal guidelines. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateGoal = async () => {
    try {
      const response = await api.post("/goals", formData);
      await fetchGoals();
      setShowCreateForm(false);
      setShowGeneratedForm(false);
      setFormData({
        name: "",
        description: "",
        guidelines: "",
        evaluationCriteria: "",
        targets: {
          calories: null,
          protein: null,
          carbs: null,
          fat: null,
        },
      });
      setGoalDescription("");

      // Select the newly created goal
      if (response.data.goalId) {
        // The goals state will be updated by fetchGoals, so we need to wait for the next render
        // or make another API call to get the goal details
        const goalResponse = await api.get(`/goals/${response.data.goalId}`);
        if (goalResponse.data.goal) {
          onGoalSelect(response.data.goalId, goalResponse.data.goal);
        }
      }
    } catch (error) {
      console.error("Error creating goal:", error);
      alert("Failed to create goal. Please try again.");
    }
  };

  const handleUpdateGoal = async () => {
    try {
      await api.put(`/goals/${editingGoal.id}`, formData);
      await fetchGoals();
      setEditingGoal(null);
      setShowGeneratedForm(false);
      setFormData({
        name: "",
        description: "",
        guidelines: "",
        evaluationCriteria: "",
        targets: {
          calories: null,
          protein: null,
          carbs: null,
          fat: null,
        },
      });
      setGoalDescription("");
    } catch (error) {
      console.error("Error updating goal:", error);
      alert("Failed to update goal. Please try again.");
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm("Are you sure you want to delete this goal?")) {
      return;
    }

    try {
      await api.delete(`/goals/${goalId}`);
      await fetchGoals();

      // If the deleted goal was selected, clear the selection
      if (selectedGoalId === goalId) {
        onGoalSelect(null);
      }
    } catch (error) {
      console.error("Error deleting goal:", error);
      alert("Failed to delete goal. Please try again.");
    }
  };

  const startEditing = (goal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      description: goal.description || "",
      guidelines: goal.guidelines || "",
      evaluationCriteria: goal.evaluation_criteria || "",
      targets: goal.targets || {
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
      },
    });
  };

  const cancelEditing = () => {
    setEditingGoal(null);
    setShowGeneratedForm(false);
    setFormData({
      name: "",
      description: "",
      guidelines: "",
      evaluationCriteria: "",
      targets: {
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
      },
    });
    setGoalDescription("");
  };

  const renderGoalForm = (isEditing = false) => {
    // If editing, show the full form
    if (isEditing) {
      return (
        <div
          style={{
            padding: "20px",
            background: "white",
            borderRadius: "12px",
            border: "2px solid #667eea",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ marginBottom: "16px", color: "#333" }}>✏️ Edit Goal</h3>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
              }}
            >
              Goal Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Keto Diet, Weight Loss, Anti-Inflammatory"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
              }}
            >
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of your goal"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
              }}
            >
              Guidelines
            </label>
            <textarea
              value={formData.guidelines}
              onChange={(e) =>
                setFormData({ ...formData, guidelines: e.target.value })
              }
              placeholder="Enter your dietary guidelines and rules..."
              style={{
                width: "100%",
                minHeight: "120px",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
              }}
            >
              Evaluation Criteria (Optional)
            </label>
            <textarea
              value={formData.evaluationCriteria}
              onChange={(e) =>
                setFormData({ ...formData, evaluationCriteria: e.target.value })
              }
              placeholder="Optional: Define specific criteria for evaluating meals (e.g., max carbs, min protein, etc.)"
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>

          {/* Numeric Targets Section */}
          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{ marginBottom: "12px", color: "#333", fontSize: "16px" }}
            >
              🎯 Numeric Targets (Optional)
            </h4>
            <p
              style={{ marginBottom: "12px", color: "#666", fontSize: "14px" }}
            >
              Set specific calorie and macro targets for this goal. Leave blank
              if not applicable.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "500",
                    fontSize: "14px",
                  }}
                >
                  Daily Calories
                </label>
                <input
                  type="number"
                  value={formData.targets.calories || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targets: {
                        ...formData.targets,
                        calories: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      },
                    })
                  }
                  placeholder="e.g., 2000"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "500",
                    fontSize: "14px",
                  }}
                >
                  Protein (g)
                </label>
                <input
                  type="number"
                  value={formData.targets.protein || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targets: {
                        ...formData.targets,
                        protein: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      },
                    })
                  }
                  placeholder="e.g., 150"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "500",
                    fontSize: "14px",
                  }}
                >
                  Carbs (g)
                </label>
                <input
                  type="number"
                  value={formData.targets.carbs || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targets: {
                        ...formData.targets,
                        carbs: e.target.value ? parseInt(e.target.value) : null,
                      },
                    })
                  }
                  placeholder="e.g., 200"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "500",
                    fontSize: "14px",
                  }}
                >
                  Fat (g)
                </label>
                <input
                  type="number"
                  value={formData.targets.fat || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targets: {
                        ...formData.targets,
                        fat: e.target.value ? parseInt(e.target.value) : null,
                      },
                    })
                  }
                  placeholder="e.g., 65"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}
          >
            <button
              onClick={cancelEditing}
              style={{
                padding: "8px 16px",
                background: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateGoal}
              disabled={!formData.name.trim()}
              style={{
                padding: "8px 16px",
                background: formData.name.trim() ? "#28a745" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: formData.name.trim() ? "pointer" : "not-allowed",
                fontSize: "14px",
              }}
            >
              Update Goal
            </button>
          </div>
        </div>
      );
    }

    // If showing generated form (after AI generation), show editable form
    if (showGeneratedForm) {
      return (
        <div
          style={{
            padding: "20px",
            background: "white",
            borderRadius: "12px",
            border: "2px solid #28a745",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ marginBottom: "16px", color: "#333" }}>
            ✨ Generated Goal Guidelines
          </h3>
          <p style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}>
            Review and edit the generated guidelines before saving your goal.
          </p>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
              }}
            >
              Goal Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Keto Diet, Weight Loss, Anti-Inflammatory"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
              }}
            >
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of your goal"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
              }}
            >
              Guidelines
            </label>
            <textarea
              value={formData.guidelines}
              onChange={(e) =>
                setFormData({ ...formData, guidelines: e.target.value })
              }
              placeholder="Enter your dietary guidelines and rules..."
              style={{
                width: "100%",
                minHeight: "120px",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
              }}
            >
              Evaluation Criteria
            </label>
            <textarea
              value={formData.evaluationCriteria}
              onChange={(e) =>
                setFormData({ ...formData, evaluationCriteria: e.target.value })
              }
              placeholder="Specific criteria for evaluating meal compliance"
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>

          {/* Numeric Targets Section */}
          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{ marginBottom: "12px", color: "#333", fontSize: "16px" }}
            >
              🎯 Numeric Targets (Optional)
            </h4>
            <p
              style={{ marginBottom: "12px", color: "#666", fontSize: "14px" }}
            >
              Set specific calorie and macro targets for this goal. Leave blank
              if not applicable.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "500",
                    fontSize: "14px",
                  }}
                >
                  Daily Calories
                </label>
                <input
                  type="number"
                  value={formData.targets.calories || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targets: {
                        ...formData.targets,
                        calories: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      },
                    })
                  }
                  placeholder="e.g., 2000"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "500",
                    fontSize: "14px",
                  }}
                >
                  Protein (g)
                </label>
                <input
                  type="number"
                  value={formData.targets.protein || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targets: {
                        ...formData.targets,
                        protein: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      },
                    })
                  }
                  placeholder="e.g., 150"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "500",
                    fontSize: "14px",
                  }}
                >
                  Carbs (g)
                </label>
                <input
                  type="number"
                  value={formData.targets.carbs || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targets: {
                        ...formData.targets,
                        carbs: e.target.value ? parseInt(e.target.value) : null,
                      },
                    })
                  }
                  placeholder="e.g., 200"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "500",
                    fontSize: "14px",
                  }}
                >
                  Fat (g)
                </label>
                <input
                  type="number"
                  value={formData.targets.fat || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targets: {
                        ...formData.targets,
                        fat: e.target.value ? parseInt(e.target.value) : null,
                      },
                    })
                  }
                  placeholder="e.g., 65"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}
          >
            <button
              onClick={() => {
                setShowGeneratedForm(false);
                setShowCreateForm(false);
                setFormData({
                  name: "",
                  description: "",
                  guidelines: "",
                  evaluationCriteria: "",
                  targets: {
                    calories: null,
                    protein: null,
                    carbs: null,
                    fat: null,
                  },
                });
                setGoalDescription("");
              }}
              style={{
                padding: "8px 16px",
                background: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGoal}
              disabled={!formData.name.trim()}
              style={{
                padding: "8px 16px",
                background: formData.name.trim() ? "#28a745" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: formData.name.trim() ? "pointer" : "not-allowed",
                fontSize: "14px",
              }}
            >
              Save Goal
            </button>
          </div>
        </div>
      );
    }

    // Initial create form with simple description input
    return (
      <div
        style={{
          padding: "20px",
          background: "white",
          borderRadius: "12px",
          border: "2px solid #667eea",
          marginBottom: "20px",
        }}
      >
        <h3 style={{ marginBottom: "16px", color: "#333" }}>
          🎯 Describe Your Goal
        </h3>
        <p style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}>
          Tell us about your dietary goal and we'll generate personalized
          guidelines for you.
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label
            style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}
          >
            Goal Description *
          </label>
          <textarea
            value={goalDescription}
            onChange={(e) => setGoalDescription(e.target.value)}
            placeholder="e.g., 'I want to follow a keto diet to lose weight and improve energy', 'I need an anti-inflammatory diet to reduce joint pain', 'I want to build muscle and gain weight'"
            style={{
              width: "100%",
              minHeight: "80px",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "16px",
              resize: "vertical",
            }}
          />
        </div>

        <div
          style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}
        >
          <button
            onClick={() => setShowCreateForm(false)}
            style={{
              padding: "8px 16px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Cancel
          </button>
          <button
            onClick={generateGoalGuidelines}
            disabled={!goalDescription.trim() || isGenerating}
            style={{
              padding: "8px 16px",
              background:
                goalDescription.trim() && !isGenerating ? "#007bff" : "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor:
                goalDescription.trim() && !isGenerating
                  ? "pointer"
                  : "not-allowed",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isGenerating ? (
              <>
                <div
                  className="spinner"
                  style={{ width: "16px", height: "16px" }}
                ></div>
                Generating...
              </>
            ) : (
              <>✨ Generate Guidelines</>
            )}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <div className="spinner" style={{ margin: "0 auto 16px auto" }}></div>
        <p>Loading goals...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Create Goal Button */}
      {!showCreateForm && !showGeneratedForm && !editingGoal && (
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: "12px 20px",
            background: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "20px",
          }}
        >
          <Plus size={20} />
          Create New Goal
        </button>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || showGeneratedForm || editingGoal) &&
        renderGoalForm(!!editingGoal)}

      {/* Goals List */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "16px", color: "#333" }}>
          Your Goals ({goals.length})
        </h3>

        {goals.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              background: "#f8f9fa",
              borderRadius: "12px",
              color: "#6c757d",
            }}
          >
            <Target size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
            <p>No goals created yet. Create your first goal to get started!</p>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {goals.map((goal) => (
              <div
                key={goal.id}
                style={{
                  padding: "16px",
                  background: selectedGoalId === goal.id ? "#e3f2fd" : "white",
                  borderRadius: "8px",
                  border:
                    selectedGoalId === goal.id
                      ? "2px solid #2196f3"
                      : "1px solid #e9ecef",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => onGoalSelect(goal.id, goal)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
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
                      <h4
                        style={{ margin: 0, color: "#333", fontSize: "18px" }}
                      >
                        {goal.name}
                      </h4>
                      {selectedGoalId === goal.id && (
                        <span
                          style={{
                            background: "#2196f3",
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "bold",
                          }}
                        >
                          SELECTED
                        </span>
                      )}
                    </div>

                    {goal.description && (
                      <p
                        style={{
                          margin: "4px 0",
                          color: "#666",
                          fontSize: "14px",
                        }}
                      >
                        {goal.description}
                      </p>
                    )}

                    {/* Numeric Targets Display */}
                    {goal.targets &&
                      (goal.targets.calories ||
                        goal.targets.protein ||
                        goal.targets.carbs ||
                        goal.targets.fat) && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            background: "#f8f9fa",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "500",
                              marginBottom: "4px",
                              color: "#333",
                            }}
                          >
                            🎯 Targets:
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            {goal.targets.calories && (
                              <span style={{ color: "#667eea" }}>
                                {goal.targets.calories} cal
                              </span>
                            )}
                            {goal.targets.protein && (
                              <span style={{ color: "#764ba2" }}>
                                {goal.targets.protein}g protein
                              </span>
                            )}
                            {goal.targets.carbs && (
                              <span style={{ color: "#f093fb" }}>
                                {goal.targets.carbs}g carbs
                              </span>
                            )}
                            {goal.targets.fat && (
                              <span style={{ color: "#ff6b6b" }}>
                                {goal.targets.fat}g fat
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                    <div
                      style={{
                        fontSize: "12px",
                        color: "#999",
                        marginTop: "8px",
                      }}
                    >
                      Created: {new Date(goal.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(goal);
                      }}
                      style={{
                        padding: "6px 8px",
                        background: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGoal(goal.id);
                      }}
                      style={{
                        padding: "6px 8px",
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalManager;
