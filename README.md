# HerbiQ Visitor Website

HerbiQ is a public educational medicinal-plant exploration platform. This website allows visitors to browse a comprehensive botanical database, view detailed information on traditional Ayurvedic uses and morphology, experience a preview of the upcoming Ask HerbiQ AI assistant, and interact with specific medicinal plant species in a 3D/AR spatial viewport.

## Features
- **Plant Explorer:** Browse the database of medicinal plants with search and category filtering.
- **Detailed Specifications:** Comprehensive morphological features, habitat, and traditional uses.
- **Ask HerbiQ (Preview):** A simulated educational AI conversational interface.
- **Augmented Reality Spatial Viewport:** 3D and WebXR AR visualization of featured botanical specimens (Tulsi, Neem, Aloe Vera, Turmeric) with interactive scaling and rotation.

## Official Data
The official source of truth for the plant database is located at `data/herbiq-plants.json`. This database is dynamically integrated into the application and should not be removed.

## Local Setup

**Prerequisites:**
- Node.js installed on your machine.

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:3000`.

## Scripts

- `npm run dev`: Starts the local development server.
- `npm run build`: Compiles the application for production deployment.
- `npm run preview`: Locally preview the production build.
- `npm run lint`: Run TypeScript type-checking and linting.
