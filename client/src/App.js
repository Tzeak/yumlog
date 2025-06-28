import React, { useState, useEffect } from 'react';
import { Upload, Trash2, BarChart3, History, Image } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [meals, setMeals] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/meals`);
      setMeals(response.data.meals || []);
    } catch (error) {
      console.error('Error fetching meals:', error);
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeFood = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);
      if (note.trim()) {
        formData.append('note', note.trim());
      }

      const response = await axios.post(`${API_BASE_URL}/analyze-food`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setAnalysis(response.data.analysis);
      await fetchMeals(); // Refresh meals list
    } catch (error) {
      console.error('Error analyzing food:', error);
      alert('Failed to analyze food image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteMeal = async (mealId) => {
    try {
      await axios.delete(`${API_BASE_URL}/meals/${mealId}`);
      await fetchMeals();
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  };

  const resetUpload = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setAnalysis(null);
    setNote('');
    // Reset the file input
    const fileInput = document.getElementById('image-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const getDailyStats = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayMeals = meals.filter(meal => 
      format(new Date(meal.createdAt), 'yyyy-MM-dd') === today
    );

    const stats = {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      mealCount: todayMeals.length
    };

    todayMeals.forEach(meal => {
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
      { name: 'Protein', value: stats.totalProtein, color: '#667eea' },
      { name: 'Carbs', value: stats.totalCarbs, color: '#764ba2' },
      { name: 'Fat', value: stats.totalFat, color: '#f093fb' }
    ].filter(item => item.value > 0);
  };

  const renderUploadTab = () => (
    <div className="card">
      <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>
        📸 Upload a Photo of Your Food
      </h2>
      
      {!selectedImage && (
        <div style={{ textAlign: 'center' }}>
          <div 
            style={{
              border: '2px dashed #667eea',
              borderRadius: '12px',
              padding: '40px',
              marginBottom: '20px',
              background: '#f8f9fa',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => document.getElementById('image-upload').click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#764ba2';
              e.currentTarget.style.background = '#f0f0f0';
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = '#667eea';
              e.currentTarget.style.background = '#f8f9fa';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file && file.type.startsWith('image/')) {
                setSelectedImage(file);
                const reader = new FileReader();
                reader.onload = (e) => setImagePreview(e.target.result);
                reader.readAsDataURL(file);
              }
            }}
          >
            <Image size={48} style={{ marginBottom: '16px', color: '#667eea' }} />
            <p style={{ fontSize: '18px', marginBottom: '8px', color: '#333' }}>
              Click to select or drag & drop an image
            </p>
            <p style={{ fontSize: '14px', color: '#6c757d' }}>
              Supports JPG, PNG, GIF, WEBP (max 10MB)
            </p>
          </div>
          
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          
          <button 
            className="btn" 
            onClick={() => document.getElementById('image-upload').click()}
          >
            <Upload size={20} />
            Choose Image
          </button>
        </div>
      )}

      {imagePreview && (
        <div style={{ textAlign: 'center' }}>
          <img 
            src={imagePreview} 
            alt="Selected food" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '400px',
              borderRadius: '12px', 
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }} 
          />
          
          <div style={{ marginBottom: '20px', width: '100%', maxWidth: '400px', margin: '0 auto 20px' }}>
            <label htmlFor="note-input" style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '500', 
              color: '#333',
              textAlign: 'left'
            }}>
              📝 Add a note (optional):
            </label>
            <textarea
              id="note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe your meal, ingredients, or any special notes..."
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: '80px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button 
              className="btn" 
              onClick={analyzeFood}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <div className="spinner"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Analyze Food
                </>
              )}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={resetUpload}
            >
              <Trash2 size={20} />
              Choose Different Image
            </button>
          </div>
        </div>
      )}

      {analysis && (
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>
            🍽️ Analysis Results
          </h3>
          
          <div className="nutrition-grid">
            <div className="nutrition-item">
              <div className="nutrition-value">{analysis.total_calories}</div>
              <div className="nutrition-label">Calories</div>
            </div>
            <div className="nutrition-item">
              <div className="nutrition-value">{analysis.total_protein}g</div>
              <div className="nutrition-label">Protein</div>
            </div>
            <div className="nutrition-item">
              <div className="nutrition-value">{analysis.total_carbs}g</div>
              <div className="nutrition-label">Carbs</div>
            </div>
            <div className="nutrition-item">
              <div className="nutrition-value">{analysis.total_fat}g</div>
              <div className="nutrition-label">Fat</div>
            </div>
            <div className="nutrition-item">
              <div className="nutrition-value">{analysis.total_fiber}g</div>
              <div className="nutrition-label">Fiber</div>
            </div>
            <div className="nutrition-item">
              <div className="nutrition-value">{analysis.total_sugar}g</div>
              <div className="nutrition-label">Sugar</div>
            </div>
          </div>

          {analysis.foods && analysis.foods.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4>Detected Foods:</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {analysis.foods.map((food, index) => (
                  <li key={index} style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>{food.name} ({food.estimated_quantity})</span>
                    <span style={{ color: '#667eea', fontWeight: 'bold' }}>
                      {food.calories} cal
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.notes && (
            <div style={{ 
              marginTop: '20px', 
              padding: '16px', 
              background: '#f8f9fa', 
              borderRadius: '8px',
              fontSize: '14px',
              color: '#6c757d'
            }}>
              <strong>Notes:</strong> {analysis.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="card">
      <h2 style={{ marginBottom: '20px' }}>
        📋 Meal History
      </h2>
      
      {meals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
          <History size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>No meals recorded yet. Upload a photo to get started!</p>
        </div>
      ) : (
        <div className="meal-list">
          {meals.map(meal => (
            <div key={meal.id} className="meal-item">
              <div className="meal-header">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <img 
                    src={`${API_BASE_URL.replace('/api', '')}/uploads/${meal.imagePath}`}
                    alt="Food"
                    className="meal-image"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="meal-info">
                    <div className="meal-title">
                      {meal.analysis.meal_type || 'Meal'}
                    </div>
                    <div className="meal-time">
                      {format(new Date(meal.createdAt), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary"
                  onClick={() => deleteMeal(meal.id)}
                  style={{ padding: '8px 12px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="nutrition-grid">
                <div className="nutrition-item">
                  <div className="nutrition-value">{meal.analysis.total_calories}</div>
                  <div className="nutrition-label">Calories</div>
                </div>
                <div className="nutrition-item">
                  <div className="nutrition-value">{meal.analysis.total_protein}g</div>
                  <div className="nutrition-label">Protein</div>
                </div>
                <div className="nutrition-item">
                  <div className="nutrition-value">{meal.analysis.total_carbs}g</div>
                  <div className="nutrition-label">Carbs</div>
                </div>
                <div className="nutrition-item">
                  <div className="nutrition-value">{meal.analysis.total_fat}g</div>
                  <div className="nutrition-label">Fat</div>
                </div>
              </div>
              
              {meal.note && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px', 
                  background: '#f8f9fa', 
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#6c757d',
                  borderLeft: '3px solid #667eea'
                }}>
                  <strong>Note:</strong> {meal.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAnalyticsTab = () => {
    const stats = getDailyStats();
    const macroData = getMacroData();

    return (
      <div className="card">
        <h2 style={{ marginBottom: '20px' }}>
          📊 Daily Analytics
        </h2>
        
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
          <div style={{ marginTop: '30px' }}>
            <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>
              Macronutrient Distribution
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
        <h1>🍽️ Yumlog</h1>
        <p>Upload a photo of your food and let AI analyze your nutrition</p>
      </div>

      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <Upload size={20} style={{ marginRight: '8px' }} />
          Upload Photo
        </div>
        <div 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={20} style={{ marginRight: '8px' }} />
          History
        </div>
        <div 
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={20} style={{ marginRight: '8px' }} />
          Analytics
        </div>
      </div>

      {activeTab === 'upload' && renderUploadTab()}
      {activeTab === 'history' && renderHistoryTab()}
      {activeTab === 'analytics' && renderAnalyticsTab()}
    </div>
  );
}

export default App; 