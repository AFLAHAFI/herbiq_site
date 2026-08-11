const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const assetsDir = path.join(projectRoot, 'assets');
const publicDir = path.join(projectRoot, 'public');
const targetAssetsDir = path.join(publicDir, 'assets');

try {
  // Check if public folder exists, if not create it
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
    console.log('Created public/ folder');
  }

  // Move the assets folder into public/assets
  if (fs.existsSync(assetsDir) && !fs.existsSync(targetAssetsDir)) {
    fs.renameSync(assetsDir, targetAssetsDir);
    console.log('✅ Successfully moved assets/ into public/assets/');
    console.log('Your images will now correctly load in the website!');
  } else if (fs.existsSync(targetAssetsDir)) {
    console.log('The assets folder is already inside the public folder!');
  } else {
    console.log('Could not find the assets folder in the root directory.');
  }
} catch (error) {
  console.error('Error moving folder:', error);
}
