const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'src/pages/student/MenteeOnboarding.tsx'),
  path.join(__dirname, 'src/pages/mentor/Onboarding.tsx'),
  path.join(__dirname, 'src/pages/tutor/TutorOnboarding.tsx')
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // We want to add PageHeader to imports if it's missing.
  if (!content.includes('PageHeader')) {
    content = content.replace(/import \{ Card, Button \} from '..\/..\/components\/ui';/, "import { Card, Button } from '../../components/ui';\nimport { PageHeader } from '../../components/shared';");
  }

  const headerRegex = /<div className="space-y-2">\s*<div className="flex items-center gap-3">\s*<span className="[^"]*">(.*?)<\/span>\s*<h2 className="text-3xl[^"]*">(.*?)<\/h2>\s*<\/div>\s*<p className="[^"]*">([\s\S]*?)<\/p>\s*<\/div>/g;

  content = content.replace(headerRegex, (match, tag, title, description) => {
    const cleanDesc = description.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
    return `<PageHeader 
                title="${title}"
                description="${cleanDesc}"
                tag="${tag.toUpperCase()}"
                icon={Shield}
                className="!mb-6"
              />`;
  });

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
});
