const fs = require('fs');
const path = require('path');

const sourceDir = __dirname;
const targetDir = path.join(__dirname, 'github_ready');

const excludeList = [
    'node_modules',
    'dist',
    'build',
    '.git',
    '.idea',
    '.vscode',
    'github_ready', // Don't copy into itself
    '.env',
    '.env.local',
    'prepare_github.js'
];

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }

    const elements = fs.readdirSync(from);
    for (const element of elements) {
        // Skip ignored files/folders
        if (excludeList.includes(element) || element.endsWith('.log')) {
            continue;
        }

        const sourcePath = path.join(from, element);
        const targetPath = path.join(to, element);

        const stat = fs.lstatSync(sourcePath);
        if (stat.isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
        } else if (stat.isDirectory()) {
            copyFolderSync(sourcePath, targetPath);
        }
    }
}

try {
    console.log('Creating clean GitHub-ready folder at: ' + targetDir);
    copyFolderSync(sourceDir, targetDir);
    console.log('✅ Successfully created the "github_ready" folder!');
    console.log('You can now open this folder, initialize Git, and push to GitHub.');
} catch (error) {
    console.error('Error copying files:', error);
}
