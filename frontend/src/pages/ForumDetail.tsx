import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ChatBubbleLeftIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import PageSEO from '../components/PageSEO';
import { API_URL } from '../config';

type ForumDetailData = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  members: number;
  posts: number;
  lastActivity: string;
  attachmentUrl?: string | null;
};

type PostItem = {
  id: string;
  title: string;
  content: string;
  forumId: string;
  attachmentUrl?: string | null;
  replies: number;
  likes: number;
  views: number;
  createdAt: string;
  author: {
    username: string;
  };
};

const formatRelativeTime = (input: string): string => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute));
    return `${mins}m ago`;
  }
  if (diffMs < day) {
    const hrs = Math.max(1, Math.floor(diffMs / hour));
    return `${hrs}h ago`;
  }
  const days = Math.max(1, Math.floor(diffMs / day));
  return `${days}d ago`;
};

const truncate = (text: string, max = 220): string => {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max).trim()}...`;
};

const isPdfFile = (url?: string | null): boolean => {
  if (!url) {
    return false;
  }
  const sanitized = url.split('?')[0].toLowerCase();
  return sanitized.endsWith('.pdf');
};

const ForumDetail: React.FC = () => {
  const { forumId = '' } = useParams();
  const navigate = useNavigate();
  const [forum, setForum] = useState<ForumDetailData | null>(null);
  const [joined, setJoined] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const token = useMemo(() => localStorage.getItem('token'), []);

  const authHeaders = useMemo(() => {
    if (!token) {
      return undefined;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const loadForum = useCallback(async () => {
    const response = await axios.get(`${API_URL}/community/forums/${forumId}`, {
      headers: authHeaders,
    });
    setForum(response.data?.data?.forum || null);
    setJoined(Boolean(response.data?.data?.joined));
  }, [authHeaders, forumId]);

  const loadPosts = useCallback(async () => {
    const response = await axios.get(`${API_URL}/community/posts?forumId=${forumId}&limit=30&sortBy=newest`);
    setPosts(response.data?.data?.posts || []);
  }, [forumId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([loadForum(), loadPosts()]);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Failed to load forum');
      } finally {
        setLoading(false);
      }
    };

    if (forumId) {
      void load();
    }
  }, [forumId, loadForum, loadPosts]);

  const handleJoin = async () => {
    if (!token) {
      navigate('/auth?redirect=' + encodeURIComponent(`/community/forums/${forumId}`));
      return;
    }

    setJoining(true);
    try {
      const response = await axios.post(`${API_URL}/community/forums/${forumId}/join`, {}, { headers: authHeaders });
      toast.success(response.data?.message || 'Joined forum successfully');
      setJoined(true);
      await loadForum();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to join forum');
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <PageSEO
        title={forum?.title ? `${forum.title} - Islamic Forum` : 'Islamic Forum Discussion'}
        description={forum?.description ? `${forum.description} Join the discussion on HikmahSphere.` : 'Join this Islamic forum discussion and connect with the global Muslim community on HikmahSphere.'}
        path={`/community/forums/${forumId}`}
      />
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 pt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <div>
              <Link to="/community" className="hover:text-emerald-700">Community</Link>
              <span className="mx-2">/</span>
              <span>Forum</span>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          </div>

          {loading && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">Loading forum...</div>
          )}

          {!loading && forum && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase font-semibold tracking-wide text-emerald-700 mb-2">Forum Category: {forum.category}</p>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">{forum.title}</h1>
                    <p className="text-slate-700 mb-4">{forum.description}</p>

                    {forum.attachmentUrl && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        <a
                          href={forum.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          {isPdfFile(forum.attachmentUrl) ? 'View PDF' : 'View Attachment'}
                        </a>
                        <a
                          href={forum.attachmentUrl}
                          download
                          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
                        >
                          {isPdfFile(forum.attachmentUrl) ? 'Download PDF' : 'Download Attachment'}
                        </a>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <UserGroupIcon className="h-4 w-4" />
                        {forum.members.toLocaleString()} members
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ChatBubbleLeftIcon className="h-4 w-4" />
                        {forum.posts.toLocaleString()} posts
                      </span>
                      <span>Last active: {formatRelativeTime(forum.lastActivity)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={joined || joining}
                    onClick={handleJoin}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {joined ? 'Joined' : (joining ? 'Joining...' : 'Join Forum')}
                  </button>
                </div>

                {!joined && (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Join this forum first. Then open any thread using Open Thread to comment, reply, ask questions, or share suggestions.
                  </div>
                )}

                {joined && (
                  <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <p className="mb-2">You are joined. Start commenting by opening a thread below.</p>
                    {posts.length > 0 ? (
                      <Link
                        to={`/community/forums/${posts[0].forumId}/posts/${posts[0].id}`}
                        className="inline-flex items-center rounded-md bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-800"
                      >
                        Start Commenting
                      </Link>
                    ) : (
                      <p className="text-xs text-emerald-700">No thread available yet. A new thread will appear here soon.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {posts.length === 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-600">No posts yet in this forum.</div>
                )}

                {posts.map((post) => (
                  <div key={post.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
                    <div className="text-xs text-slate-500 mb-2">
                      Posted by {post.author.username} • {formatRelativeTime(post.createdAt)}
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">{post.title}</h2>
                    <p className="text-slate-700 mb-4">{truncate(post.content)}</p>

                    {post.attachmentUrl && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        <a
                          href={post.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          {isPdfFile(post.attachmentUrl) ? 'View PDF' : 'View Attachment'}
                        </a>
                        <a
                          href={post.attachmentUrl}
                          download
                          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100"
                        >
                          {isPdfFile(post.attachmentUrl) ? 'Download PDF' : 'Download Attachment'}
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <div className="flex items-center gap-4">
                        <span>{post.likes} likes</span>
                        <span>{post.replies} comments</span>
                        <span>{post.views} views</span>
                      </div>
                      <Link
                        to={`/community/forums/${post.forumId}/posts/${post.id}`}
                        className="text-emerald-700 font-semibold hover:text-emerald-800"
                      >
                        Open Thread & Comment
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ForumDetail;
