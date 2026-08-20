/**
 * Feeds API Netlify Function
 * Serves endpoints:
 *   - GET /api/feeds/:userId
 *   - POST /api/posts
 *   - PUT /api/posts/:postId
 *   - DELETE /api/posts/:postId
 *   - GET /api/posts/:postId/comments
 *   - POST /api/comments
 *   - DELETE /api/comments/:commentId
 *   - POST /api/likes
 *   - POST /api/follows
 *   - DELETE /api/follows/:followId
 *   - GET /api/notifications/:userId
 */

const { createClient } = require('@insforge/sdk');

const INSFORGE_URL = process.env.VITE_INSFORGE_URL || process.env.INSFORGE_URL || 'https://25t8cbg8.us-east.insforge.app';
const INSFORGE_ANON_KEY = process.env.VITE_INSFORGE_ANON_KEY || process.env.INSFORGE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub25AiWF0IjoxNzc5OTYwNTg3fQ.8-rujjlus4kbAMt5BAdXU6r9GAWq8m27OSh8qWV5gpw';

const nexus = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const rawPath = event.path || '';
  const method = event.httpMethod;

  // Extract path parameters: path parameter might come through query string ?path=... or event.path
  let path = rawPath.replace(/^\/\.netlify\/functions\/feeds_api/, '').replace(/^\/api/, '');
  if (event.queryStringParameters && event.queryStringParameters.path) {
    path = '/' + event.queryStringParameters.path;
  }

  const pathParts = path.split('/').filter(Boolean); // e.g. ['feeds', '123'] or ['posts', '456', 'comments']

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      body = {};
    }
  }

  try {
    // 1. GET /api/feeds/:userId
    if (method === 'GET' && pathParts[0] === 'feeds' && pathParts[1]) {
      const userId = pathParts[1];
      const { data: posts, error } = await nexus.database
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ posts: posts || [] }) };
    }

    // 2. GET /api/posts/:postId/comments
    if (method === 'GET' && pathParts[0] === 'posts' && pathParts[2] === 'comments') {
      const postId = pathParts[1];
      const { data: comments, error } = await nexus.database
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ comments: comments || [] }) };
    }

    // 3. POST /api/posts — Create new post
    if (method === 'POST' && pathParts[0] === 'posts' && pathParts.length === 1) {
      const { author_id, content, media_urls, tags } = body;
      if (!author_id || !content) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing author_id or content' }) };
      }

      const postId = 'post_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const newPost = {
        id: postId,
        author_id,
        content,
        media_urls: media_urls || [],
        tags: tags || [],
        likes_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await nexus.database.from('posts').insert([newPost]).select().single();
      if (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }

      return { statusCode: 201, headers: corsHeaders, body: JSON.stringify({ post: data }) };
    }

    // 4. PUT /api/posts/:postId — Update a post
    if (method === 'PUT' && pathParts[0] === 'posts' && pathParts[1]) {
      const postId = pathParts[1];
      const { content, author_id } = body;

      const { data: existing } = await nexus.database.from('posts').select('author_id').eq('id', postId).maybeSingle();
      if (existing && author_id && existing.author_id !== author_id) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden: You can only edit your own posts' }) };
      }

      const { error } = await nexus.database
        .from('posts')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', postId);

      if (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    // 5. DELETE /api/posts/:postId — Delete a post
    if (method === 'DELETE' && pathParts[0] === 'posts' && pathParts[1]) {
      const postId = pathParts[1];
      const authorId = body.author_id || event.queryStringParameters?.author_id;

      if (authorId) {
        const { data: existing } = await nexus.database.from('posts').select('author_id').eq('id', postId).maybeSingle();
        if (existing && existing.author_id !== authorId) {
          return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden: You can only delete your own posts' }) };
        }
      }

      const { error } = await nexus.database.from('posts').delete().eq('id', postId);
      if (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    // 6. POST /api/comments — Add a comment
    if (method === 'POST' && pathParts[0] === 'comments') {
      const { post_id, author_id, content, parent_comment_id } = body;
      if (!post_id || !author_id || !content) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing post_id, author_id or content' }) };
      }

      const commentId = 'cmt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const newComment = {
        id: commentId,
        post_id,
        author_id,
        parent_comment_id: parent_comment_id || null,
        content,
        created_at: new Date().toISOString()
      };

      const { data, error } = await nexus.database.from('comments').insert([newComment]).select().single();
      if (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 201, headers: corsHeaders, body: JSON.stringify({ comment: data }) };
    }

    // 7. DELETE /api/comments/:commentId — Delete a comment
    if (method === 'DELETE' && pathParts[0] === 'comments' && pathParts[1]) {
      const commentId = pathParts[1];
      const authorId = body.author_id || event.queryStringParameters?.author_id;

      if (authorId) {
        const { data: existing } = await nexus.database.from('comments').select('author_id').eq('id', commentId).maybeSingle();
        if (existing && existing.author_id !== authorId) {
          return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden: You can only delete your own comments' }) };
        }
      }

      const { error } = await nexus.database.from('comments').delete().eq('id', commentId);
      if (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    // 8. POST /api/likes — Toggle like
    if (method === 'POST' && pathParts[0] === 'likes') {
      const { user_id, target_type, target_id } = body;
      if (!user_id || !target_type || !target_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing user_id, target_type or target_id' }) };
      }

      const { data: existing } = await nexus.database
        .from('likes')
        .select('id')
        .eq('user_id', user_id)
        .eq('target_type', target_type)
        .eq('target_id', target_id)
        .maybeSingle();

      let isLiked = false;
      if (existing) {
        await nexus.database.from('likes').delete().eq('id', existing.id);
      } else {
        await nexus.database.from('likes').insert([{
          user_id,
          target_type,
          target_id,
          created_at: new Date().toISOString()
        }]);
        isLiked = true;
      }

      const { data: allLikes } = await nexus.database
        .from('likes')
        .select('id')
        .eq('target_type', target_type)
        .eq('target_id', target_id);

      const likesCount = allLikes ? allLikes.length : 0;

      if (target_type === 'post') {
        await nexus.database.from('posts').update({ likes_count: likesCount }).eq('id', target_id);
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ isLiked, likesCount }) };
    }

    // 9. POST /api/follows — Follow a user
    if (method === 'POST' && pathParts[0] === 'follows') {
      const { follower_id, following_id } = body;
      if (!follower_id || !following_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing follower_id or following_id' }) };
      }

      const { error } = await nexus.database.from('follows').insert([{
        follower_id,
        following_id,
        created_at: new Date().toISOString()
      }]);

      if (error && !error.message?.includes('duplicate')) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    // 10. DELETE /api/follows/:followId or body/query unfollow
    if (method === 'DELETE' && pathParts[0] === 'follows') {
      const follower_id = body.follower_id || event.queryStringParameters?.follower_id;
      const following_id = body.following_id || event.queryStringParameters?.following_id;
      const followId = pathParts[1];

      let query = nexus.database.from('follows').delete();
      if (followId && followId !== 'delete') {
        query = query.eq('id', followId);
      } else if (follower_id && following_id) {
        query = query.eq('follower_id', follower_id).eq('following_id', following_id);
      }

      const { error } = await query;
      if (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    // 11. GET /api/notifications/:userId
    if (method === 'GET' && pathParts[0] === 'notifications' && pathParts[1]) {
      const userId = pathParts[1];
      const { data: notifications, error } = await nexus.database
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ notifications: notifications || [] }) };
    }

    return { statusCode: 44, headers: corsHeaders, body: JSON.stringify({ error: 'Endpoint not found', path, method }) };
  } catch (err) {
    console.error('[Feeds API Error]:', err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || 'Internal Server Error' }) };
  }
};
