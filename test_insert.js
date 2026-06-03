import { createClient } from '@insforge/sdk';

const baseUrl = 'https://25t8cbg8.us-east.insforge.app';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjA1ODd9.8-rujjlus4kbAMt5BAdXU6r9GAWq8m27OSh8qWV5gpw';

const insforge = createClient({
  baseUrl,
  anonKey
});

async function main() {
  const newHighlight = {
    id: `h-test-${Date.now()}`,
    user_id: '763f4330-f5f4-4475-9cf9-b1ca2ad210c1',
    book_id: 'b-1780153563147',
    passage_text: 'The study conducted in-depth expert interviews with twenty (20) carefully selected ARCON (Architect Re',
    comment: 'wow',
    color: 'yellow',
  };

  console.log("Attempting insert...");
  try {
    const { data, error } = await insforge.database
      .from('book_highlights')
      .insert([newHighlight])
      .select();

    if (error) {
      console.error("Insert error:", error);
    } else {
      console.log("Insert success:", data);
    }
  } catch (err) {
    console.error("Caught exception:", err);
  }
}

main();
