import React, { useState, useEffect } from 'react';
import { Upload, Trash2, BarChart3, History, Image, LogOut, Settings, Key, Edit, Trash } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ClerkProvider, SignIn, useUser, useAuth, useClerk, useSignIn } from '@clerk/clerk-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Create axios instance with auth interceptor
const api = axios.create({
  baseURL: API_BASE_URL,
});

function AppContent() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState('upload');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [meals, setMeals] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [note, setNote] = useState('');

  // Add auth token to all requests
  useEffect(() => {
    const interceptor = api.interceptors.request.use(async (config) => {
      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token) {
            // For Clerk, we'll use the user ID and phone number as our token
            const phoneNumber = user?.primaryPhoneNumber?.phoneNumber || '';
            config.headers.Authorization = `Bearer ${user.id}:${phoneNumber}`;
          }
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, [isSignedIn, user, getToken]);

  useEffect(() => {
    if (isSignedIn) {
      fetchMeals();
    }
  }, [isSignedIn]);

  const fetchMeals = async () => {
    try {
      const response = await api.get('/meals');
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

      const response = await api.post('/analyze-food', formData, {
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
      await api.delete(`/meals/${mealId}`);
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

  // Show loading state while Clerk is loading
  if (!isLoaded) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#667eea'
      }}>
        Loading...
      </div>
    );
  }

  // Show sign-in if not authenticated
  if (!isSignedIn) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center'
        }}>
          <h1 style={{ 
            marginBottom: '30px', 
            color: '#333',
            fontSize: '28px'
          }}>
            🍎 Yumlog
          </h1>
          <p style={{ 
            marginBottom: '30px', 
            color: '#666',
            lineHeight: '1.6'
          }}>
            log your yums. quick stats.
          </p>
          
          <div style={{ marginBottom: '20px' }}>
            <SignInWithPasskeyButton />
          </div>
          
          <div style={{ 
            marginBottom: '20px', 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
            <span style={{ margin: '0 16px', color: '#666', fontSize: '14px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
          </div>
          
          <SignIn />
        </div>
      </div>
    );
  }

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
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              color: '#333'
            }}>
              Optional Note:
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about your meal..."
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: '80px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button 
              className="btn btn-primary" 
              onClick={analyzeFood}
              disabled={isAnalyzing}
              style={{ minWidth: '120px' }}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Food'}
            </button>
            
            <button 
              className="btn btn-secondary" 
              onClick={resetUpload}
              disabled={isAnalyzing}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {analysis && (
        <div style={{ 
          marginTop: '30px',
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '12px',
          border: '2px solid #667eea'
        }}>
          <h3 style={{ marginBottom: '16px', color: '#333' }}>🍽️ Analysis Results</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                {analysis.total_calories || 0}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>Calories</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                {analysis.total_protein || 0}g
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>Protein</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                {analysis.total_carbs || 0}g
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>Carbs</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                {analysis.total_fat || 0}g
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>Fat</div>
            </div>
          </div>
          
          {analysis.notes && (
            <div style={{ 
              padding: '16px', 
              background: 'white', 
              borderRadius: '8px',
              borderLeft: '4px solid #667eea'
            }}>
              <h4 style={{ marginBottom: '8px', color: '#333' }}>AI Notes:</h4>
              <p style={{ color: '#666', lineHeight: '1.6', margin: 0 }}>
                {analysis.notes}
              </p>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>🍽️ Yumlog</h1>
            <p>Upload a photo of your food and let AI analyze your nutrition</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 12px',
                background: '#f8f9fa',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#666',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setShowSettings(!showSettings)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e9ecef';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8f9fa';
              }}
            >
              <Settings size={16} />
              <span>{user?.primaryPhoneNumber?.phoneNumber || 'User'}</span>
            </div>
            <button 
              className="btn btn-secondary"
              onClick={() => signOut()}
              style={{ padding: '8px 12px' }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
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
      
      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0, color: '#333' }}>⚙️ Settings</h2>
              <button 
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ marginBottom: '16px', color: '#333' }}>🔐 Passkey Management</h3>
              <p style={{ marginBottom: '20px', color: '#666' }}>
                Passkeys provide secure, passwordless authentication using your device's biometrics or PIN.
              </p>
              
              <div style={{ marginBottom: '20px' }}>
                <CreatePasskeyButton />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <SignInWithPasskeyButton />
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
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
      console.error('Error:', JSON.stringify(err, null, 2));
    }
  };

  return (
    <button 
      className="btn btn-primary" 
      onClick={createClerkPasskey}
      style={{ marginBottom: '16px' }}
    >
      <Key size={16} style={{ marginRight: '8px' }} />
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
      console.log('User is already signed in');
      return;
    }

    try {
      const signInAttempt = await signIn?.authenticateWithPasskey({
        flow: 'discoverable',
      });

      if (signInAttempt?.status === 'complete') {
        console.log('Passkey authentication successful');
        // Properly activate the session
        await setActive({ session: signInAttempt.createdSessionId });
      } else {
        console.log('Sign-in attempt status:', signInAttempt?.status);
      }
    } catch (err) {
      // Handle specific error cases
      if (err.errors && err.errors.some(e => e.code === 'session_exists')) {
        console.log('User is already signed in - this is expected after successful authentication');
        // Try to refresh the session
        try {
          await setActive();
        } catch (refreshError) {
          console.error('Error refreshing session:', refreshError);
        }
      } else {
        console.error('Passkey authentication error:', JSON.stringify(err, null, 2));
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
      style={{ marginBottom: '16px' }}
    >
      <Key size={16} style={{ marginRight: '8px' }} />
      Sign in with a passkey
    </button>
  );
}

function PasskeyList() {
  const { user } = useUser();
  const { passkeys } = user || {};
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState('');
  const [success, setSuccess] = useState('');

  const startEditing = (passkey) => {
    setEditingId(passkey.id);
    setNewName(passkey.name || '');
    setSuccess('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewName('');
    setSuccess('');
  };

  const saveEdit = async () => {
    try {
      const passkeyToUpdate = passkeys?.find((pk) => pk.id === editingId);
      await passkeyToUpdate?.update({ name: newName });
      setSuccess('Passkey renamed successfully!');
      setEditingId(null);
      setNewName('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error:', JSON.stringify(err, null, 2));
      setSuccess('Error renaming passkey');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const deletePasskey = async (passkeyId) => {
    try {
      const passkeyToDelete = passkeys?.find((pk) => pk.id === passkeyId);
      await passkeyToDelete?.delete();
      setSuccess('Passkey deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error:', JSON.stringify(err, null, 2));
      setSuccess('Error deleting passkey');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  if (!passkeys || passkeys.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '20px', 
        color: '#666',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <Key size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
        <p>No passkeys set up yet. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <h4 style={{ marginBottom: '16px', color: '#333' }}>Your Passkeys</h4>
      
      {success && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '16px',
          borderRadius: '6px',
          background: success.includes('Error') ? '#f8d7da' : '#d4edda',
          color: success.includes('Error') ? '#721c24' : '#155724',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {passkeys?.map((pk) => (
          <div 
            key={pk.id} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}
          >
            <div style={{ flex: 1 }}>
              {editingId === pk.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      flex: 1
                    }}
                    placeholder="Enter passkey name"
                  />
                  <button 
                    onClick={saveEdit}
                    style={{
                      padding: '6px 8px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Save
                  </button>
                  <button 
                    onClick={cancelEditing}
                    style={{
                      padding: '6px 8px',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: '#333',
                    marginBottom: '4px'
                  }}>
                    {pk.name || 'Unnamed Passkey'}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#6c757d' 
                  }}>
                    ID: {pk.id}
                  </div>
                </div>
              )}
            </div>
            
            {editingId !== pk.id && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => startEditing(pk)}
                  style={{
                    padding: '6px 8px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px'
                  }}
                >
                  <Edit size={12} />
                  Edit
                </button>
                <button 
                  onClick={() => deletePasskey(pk.id)}
                  style={{
                    padding: '6px 8px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px'
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
  console.log('🔍 Clerk Environment Debug Info:');
  console.log('- REACT_APP_CLERK_PUBLISHABLE_KEY:', publishableKey ? `${publishableKey.substring(0, 20)}...` : 'NOT SET');
  console.log('- All REACT_APP_ env vars:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
  console.log('- Node environment:', process.env.NODE_ENV);
  console.log('- Current URL:', window.location.href);
  
  if (!publishableKey) {
    console.error('❌ Clerk publishable key is missing!');
    console.error('Environment variables available:', Object.keys(process.env));
    
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#667eea',
        flexDirection: 'column',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '20px' }}>🔑 Configuration Error</h2>
        <p style={{ marginBottom: '20px' }}>
          Clerk publishable key not found. Please check your environment variables.
        </p>
        <div style={{ 
          background: '#f8f9fa', 
          padding: '20px', 
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'left',
          maxWidth: '600px'
        }}>
          <h4>Debug Information:</h4>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>Environment: {process.env.NODE_ENV}</li>
            <li>URL: {window.location.href}</li>
            <li>REACT_APP_ variables: {Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')).join(', ') || 'None found'}</li>
          </ul>
          <h4>How to fix:</h4>
          <ol style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>Check if <code>.env</code> file exists in the client directory</li>
            <li>Verify <code>REACT_APP_CLERK_PUBLISHABLE_KEY</code> is set correctly</li>
            <li>Restart the development server after changing environment variables</li>
            <li>For production, ensure the environment variable is set in your hosting platform</li>
          </ol>
        </div>
      </div>
    );
  }

  // Validate the key format
  if (!publishableKey.startsWith('pk_')) {
    console.error('❌ Invalid Clerk publishable key format!');
    console.error('Key should start with "pk_test_" or "pk_live_"');
    
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#dc3545',
        flexDirection: 'column',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '20px' }}>🔑 Invalid Key Format</h2>
        <p style={{ marginBottom: '20px' }}>
          Clerk publishable key has invalid format. Key should start with "pk_test_" or "pk_live_".
        </p>
        <div style={{ 
          background: '#f8d7da', 
          padding: '20px', 
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'left',
          maxWidth: '600px'
        }}>
          <h4>Current key format:</h4>
          <code style={{ background: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
            {publishableKey.substring(0, 20)}...
          </code>
          <h4 style={{ marginTop: '16px' }}>Expected format:</h4>
          <code style={{ background: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
            pk_test_... or pk_live_...
          </code>
        </div>
      </div>
    );
  }

  console.log('✅ Clerk publishable key found and validated');

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <AppContent />
    </ClerkProvider>
  );
}

export default App; 