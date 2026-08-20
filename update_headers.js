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

  // A regex to match the step header blocks:
  /*
  <div className="space-y-2">
    <div className="flex items-center gap-3">
      <span className="px-3 py-1 rounded-full ...">Section X</span>
      <h2 className="text-3xl font-black ...">Title Here</h2>
    </div>
    <p className="...">Description here</p>
  </div>
  */
  // Note: some spans have different classes (e.g. bg-emerald-500/20 text-emerald-700). 
  // Let's use a robust regex or we can just find them easily since the structure is consistent.

  const headerRegex = /<div className="space-y-2">\s*<div className="flex items-center gap-3">\s*<span className="[^"]*">(.*?)<\/span>\s*<h2 className="text-3xl[^"]*">(.*?)<\/h2>\s*<\/div>\s*<p className="[^"]*">([\s\S]*?)<\/p>\s*<\/div>/g;

  content = content.replace(headerRegex, (match, tag, title, description) => {
    // extract pure text from title if there is any HTML inside? (probably not, it's just text)
    // clean up description which might have line breaks
    const cleanDesc = description.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
    // Icon doesn't exist in the original block, we can just use Shield for now, or match the context.
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
