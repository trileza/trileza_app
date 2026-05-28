const fs = require('fs');

const books = Array.from({length: 20}, (_, i) => 
  `('b${i+1}', 'Expert Guide ${i+1}: Advanced Topics', 'mentor1', 'Dr. Amina Hassan', 'https://images.unsplash.com/photo-1544716278-ca5e3f4cb8c0?auto=format&fit=crop&w=400&q=80', ${Math.floor(Math.random() * 50) + 10}, ${Math.floor(Math.random() * 10) + 2}, 'Software Engineering', 'An in-depth guide covering advanced concepts and practical patterns for modern development.', ${(Math.random() * 2 + 3).toFixed(1)}, 'Featured')`
);

const courses = Array.from({length: 20}, (_, i) => {
  const categories = ['AI & Machine Learning', 'UI/UX Design', 'DevOps', 'Data Science'];
  const titles = ['AI', 'Design', 'DevOps', 'Data Science'];
  const c = categories[i%4];
  const t = titles[i%4];
  return `('c${i+10}', 'mentor2', 'Masterclass ${i+1}: Advanced ${t}', 'A comprehensive masterclass taking you from intermediate to expert level with hands-on projects.', 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=800&q=80', null, '${c}', ${Math.floor(Math.random() * 50000) + 10000}, ${Math.floor(Math.random() * 100000) + 50000}, ${(Math.random() * 2 + 3).toFixed(1)}, ${Math.floor(Math.random() * 5000)}, '["Build real projects", "Master advanced patterns", "Get certified"]', null, null, null, null, 'published')`;
});

const sql = `
INSERT INTO books (id, title, author_id, author_name, cover_url, retail_price, rental_price, category, description, rating, section) VALUES 
${books.join(',\n')} 
ON CONFLICT (id) DO NOTHING;

INSERT INTO courses (id, tutor_id, title, description, thumbnail_url, trailer_url, category, price_standard, price_elite, rating, enrolled_count, learning_objectives, syllabus_url, branding, social_triggers, live_schedule, status) VALUES 
${courses.join(',\n')} 
ON CONFLICT (id) DO NOTHING;
`;

fs.writeFileSync('scratch_seed_all.sql', sql);
console.log('SQL generated successfully.');
