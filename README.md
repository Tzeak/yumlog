# 🍽️ Yumlog

A modern food logging application that uses AI to analyze food photos and provide detailed nutritional information. Built with React, Node.js, and OpenAI's GPT-4 Vision API.

## ✨ Features

- **📸 AI-Powered Food Analysis**: Upload photos of your meals and get instant nutritional breakdown
- **🎯 Detailed Macros**: Get protein, carbs, fat, fiber, and sugar content
- **📊 Daily Analytics**: Track your daily calorie and macro intake with beautiful charts
- **📋 Meal History**: View and manage your past meals
- **📱 Responsive Design**: Works perfectly on desktop and mobile devices
- **🔒 Local Storage**: All data stored locally with SQLite database
- **🖱️ Drag & Drop**: Easy file upload with drag and drop support

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd yumlog
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   npm install
   
   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp env.example .env
   
   # Edit .env and add your OpenAI API key
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Start the application**
   ```bash
   # Start the backend server (in one terminal)
   npm run dev
   
   # Start the frontend (in another terminal)
   npm run client
   ```

5. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_PATH=./data/yumlog.db

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### Getting an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env` file

## 📱 Usage

### Uploading Food Photos

1. Click the **Upload Photo** tab
2. Click the upload area or drag & drop an image file
3. Supported formats: JPG, PNG, GIF, WEBP (max 10MB)
4. Click **Analyze Food** to get nutritional information

### Viewing Results

After analysis, you'll see:
- **Total calories** for the meal
- **Macronutrient breakdown** (protein, carbs, fat, fiber, sugar)
- **Individual food items** detected with their portions
- **AI notes** about the meal

### Managing Meals

- **History Tab**: View all your past meals with timestamps
- **Analytics Tab**: See daily totals and macronutrient distribution charts
- **Delete Meals**: Click the trash icon to remove meals from your history

## 🏗️ Architecture

### Backend (Node.js/Express)

- **Server**: Express.js with CORS and file upload support
- **Database**: SQLite for local data storage
- **AI Integration**: OpenAI GPT-4 Vision API for food analysis
- **File Storage**: Local file system for image storage

### Frontend (React)

- **UI Framework**: React with modern hooks
- **Styling**: Custom CSS with responsive design
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React for beautiful icons
- **HTTP Client**: Axios for API communication
- **File Upload**: Native HTML5 file input with drag & drop

### Key Components

```
├── server/
│   ├── index.js              # Main Express server
│   └── services/
│       ├── openai.js         # OpenAI API integration
│       └── database.js       # SQLite database operations
├── client/
│   ├── src/
│   │   ├── App.js           # Main React component
│   │   ├── index.js         # React entry point
│   │   └── index.css        # Global styles
│   └── public/
│       └── index.html       # HTML template
└── uploads/                 # Image storage directory
```

## 🔍 API Endpoints

### Health Check
- `GET /api/health` - Check server status

### Food Analysis
- `POST /api/analyze-food` - Upload and analyze food image
- `GET /api/meals` - Get all meals
- `DELETE /api/meals/:id` - Delete a specific meal

### File Serving
- `GET /uploads/:filename` - Serve uploaded images

## 🎨 Customization

### Styling
The app uses a modern gradient design with purple/blue theme. You can customize colors in:
- `client/src/index.css` - Main styles
- `client/public/index.html` - Background gradient

### AI Analysis
Modify the AI prompt in `server/services/openai.js` to change how the AI analyzes food images.

### Database Schema
The SQLite schema is defined in `server/services/database.js`. You can add new fields or tables as needed.

## 🚨 Troubleshooting

### Common Issues

1. **File upload not working**
   - Check file size (max 10MB)
   - Ensure image format is supported (JPEG, PNG, GIF, WEBP)
   - Verify uploads directory has write permissions
   - Try refreshing the page

2. **OpenAI API errors**
   - Verify your API key is correct
   - Check your OpenAI account has sufficient credits
   - Ensure you're using a supported model

3. **Image analysis fails**
   - Check file size (max 10MB)
   - Ensure image format is supported (JPEG, PNG, etc.)
   - Verify uploads directory has write permissions

4. **Database errors**
   - Check the data directory exists and is writable
   - Restart the server to reinitialize the database

### Development Tips

- Use `npm run dev` for backend development with auto-restart
- Check browser console for frontend errors
- Monitor server logs for backend issues
- Use browser dev tools to inspect network requests

## 📈 Future Enhancements

- [ ] User authentication and profiles
- [ ] Meal planning and recipes
- [ ] Barcode scanning for packaged foods
- [ ] Export data to CSV/PDF
- [ ] Mobile app (React Native)
- [ ] Social features and sharing
- [ ] Integration with fitness trackers
- [ ] Advanced analytics and trends

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for providing the GPT-4 Vision API
- React team for the amazing framework
- The open-source community for various libraries used

---

**Note**: This app is for educational and personal use. Always consult with healthcare professionals for accurate nutritional advice. 