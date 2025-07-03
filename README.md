# Total Asset Browser
A desktop application for browsing and previewing game assets. It's currently a work in progress, but it's already useful for quickly previewing many file types.

### Features
- Adding multiple favorite folders to browse assets
- Previewing audio, video, 3D, images
- Going to next/previous asset in the folder
- Opening current folder or viewing current file in explorer
- Filtering by file name

### Prerequisites
- Node.js 18+ 
- npm

## Installation
```bash
# Clone the repository
git clone git@github.com:Pelax/total-asset-browser.git
cd total-asset-browser

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will start on `http://localhost:5173` with the API server on `http://localhost:3001`.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- I know very little about web development so this was created and expanded using several chat bots (bolt, claude, minimax, deepseek, etc)
- Uses Three.js for 3D model rendering
- Built with React, TypeScript, and Tailwind CSS
