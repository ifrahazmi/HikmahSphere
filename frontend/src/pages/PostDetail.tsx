import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import PageSEO from '../components/PageSEO';
import { API_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

type PostDetailType = {
  id: string;
  title: string;
  content: string;
  forumId: string;
  imageUrl?: string | null;
  attachmentUrl?: string | null;
  externalLink?: string | null;
  videoUrl?: string | null;
  replies: number;
  likes: number;
  views: number;
  createdAt: string;
  author: {
    id: string;
    username: string;
  };
};

type CommentItem = {
  id: string;
  postId: string;
  forumId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
  };
  replies: CommentItem[];
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

const isPdfFile = (url?: string | null): boolean => {
  if (!url) {
    return false;
  }
  const sanitized = url.split('?')[0].toLowerCase();
  return sanitized.endsWith('.pdf');
};

const PostDetail: React.FC = () => {
  const { forumId = '', postId = '' } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [post, setPost] = useState<PostDetailType | null>(null);
  const [joined, setJoined] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyDraftByComment, setReplyDraftByComment] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState(false);
  const [postingReplyFor, setPostingReplyFor] = useState<string | null>(null);
  const [deletingCommentFor, setDeletingCommentFor] = useState<string | null>(null);

  const token = useMemo(() => localStorage.getItem('token'), []);
  const authHeaders = useMemo(() => {
    if (!token) {
      return undefined;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const isAdmin = hasRole(['superadmin', 'manager']);

  const loadPost = useCallback(async () => {
    const response = await axios.get(`${API_URL}/community/posts/${postId}`);
    setPost(response.data?.data?.post || null);
  }, [postId]);

  const loadForumMembership = useCallback(async () => {
    const response = await axios.get(`${API_URL}/community/forums/${forumId}`, { headers: authHeaders });
    setJoined(Boolean(response.data?.data?.joined));
  }, [authHeaders, forumId]);

  const loadComments = useCallback(async () => {
    const response = await axios.get(`${API_URL}/community/posts/${postId}/comments?limit=100`);
    setComments(response.data?.data?.comments || []);
  }, [postId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([loadPost(), loadComments(), loadForumMembership()]);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Failed to load discussion');
      } finally {
        setLoading(false);
      }
    };

    if (forumId && postId) {
      void load();
    }
  }, [forumId, postId, loadComments, loadForumMembership, loadPost]);

  const handleJoinAndReturn = () => {
    if (!token) {
      navigate('/auth?redirect=' + encodeURIComponent(`/community/forums/${forumId}/posts/${postId}`));
      return;
    }

    void axios.post(`${API_URL}/community/forums/${forumId}/join`, {}, { headers: authHeaders })
      .then(() => {
        setJoined(true);
        toast.success('Joined forum successfully');
      })
      .catch((error: any) => {
        toast.error(error?.response?.data?.message || 'Unable to join forum');
      });
  };

  const handleSubmitComment = async () => {
    const content = commentDraft.trim();
    if (!content) {
      toast.error('Please write a comment first');
      return;
    }
    if (!token) {
      navigate('/auth?redirect=' + encodeURIComponent(`/community/forums/${forumId}/posts/${postId}`));
      return;
    }
    if (!joined && !isAdmin) {
      toast.error('Join this forum first to comment');
      return;
    }

    setPostingComment(true);
    try {
      await axios.post(`${API_URL}/community/posts/${postId}/comments`, { content }, { headers: authHeaders });
      setCommentDraft('');
      await Promise.all([loadComments(), loadPost()]);
      toast.success('Comment posted');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleSubmitReply = async (commentId: string) => {
    const content = (replyDraftByComment[commentId] || '').trim();
    if (!content) {
      toast.error('Please write a reply first');
      return;
    }
    if (!token) {
      navigate('/auth?redirect=' + encodeURIComponent(`/community/forums/${forumId}/posts/${postId}`));
      return;
    }
    if (!joined && !isAdmin) {
      toast.error('Join this forum first to reply');
      return;
    }

    setPostingReplyFor(commentId);
    try {
      await axios.post(`${API_URL}/community/comments/${commentId}/replies`, { content }, { headers: authHeaders });
      setReplyDraftByComment((prev) => ({ ...prev, [commentId]: '' }));
      await Promise.all([loadComments(), loadPost()]);
      toast.success('Reply posted');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to post reply');
    } finally {
      setPostingReplyFor(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!token) {
      navigate('/auth?redirect=' + encodeURIComponent(`/community/forums/${forumId}/posts/${postId}`));
      return;
    }
    if (!isAdmin) {
      toast.error('Only admin can delete comments');
      return;
    }

    const confirmed = window.confirm('Delete this comment? This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    setDeletingCommentFor(commentId);
    try {
      await axios.delete(`${API_URL}/community/comments/${commentId}`, { headers: authHeaders });
      await Promise.all([loadComments(), loadPost()]);
      toast.success('Comment deleted');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete comment');
    } finally {
      setDeletingCommentFor(null);
    }
  };

  const renderComment = (comment: CommentItem, depth = 0) => {
    const depthClass = depth > 0 ? 'border-l-2 border-slate-200 pl-3 sm:pl-4 ml-2 sm:ml-4' : '';

    return (
      <div key={comment.id} className={`py-2 ${depthClass}`}>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{comment.author.username}</span>
              <span className="mx-1">•</span>
              {formatRelativeTime(comment.createdAt)}
            </p>
            {isAdmin && (
              <button
                type="button"
                disabled={deletingCommentFor === comment.id}
                onClick={() => handleDeleteComment(comment.id)}
                className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deletingCommentFor === comment.id ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>

          {depth > 0 && (
            <p className="text-[11px] text-slate-500 mb-2">Reply in thread</p>
          )}
          <p className="text-slate-800 text-sm mb-3 whitespace-pre-line">{comment.content}</p>

          <div className="flex gap-2">
            <input
              type="text"
              value={replyDraftByComment[comment.id] || ''}
              onChange={(event) => setReplyDraftByComment((prev) => ({ ...prev, [comment.id]: event.target.value }))}
              placeholder="Reply to this comment"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              disabled={postingReplyFor === comment.id}
              onClick={() => handleSubmitReply(comment.id)}
              className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {postingReplyFor === comment.id ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </div>

        {comment.replies?.length > 0 && (
          <div className="mt-2 space-y-1">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <PageSEO
        title={post?.title ? `${post.title} | Islamic Community` : 'Community Discussion'}
        description={post?.content ? `${post.content.slice(0, 150)}...` : 'Read and participate in this threaded Islamic forum discussion on HikmahSphere.'}
        path={`/community/forums/${forumId}/posts/${postId}`}
      />

      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <div>
              <Link to="/community" className="hover:text-emerald-700">Community</Link>
              <span className="mx-2">/</span>
              <Link to={`/community/forums/${forumId}`} className="hover:text-emerald-700">Forum</Link>
              <span className="mx-2">/</span>
              <span>Post</span>
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
            <div className="bg-white border border-slate-200 rounded-xl p-6">Loading post discussion...</div>
          )}

          {!loading && post && (
            <>
              <article className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
                <div className="text-xs text-slate-500 mb-2">Posted by {post.author.username} • {formatRelativeTime(post.createdAt)}</div>
                <h1 className="text-2xl font-bold text-slate-900 mb-3">{post.title}</h1>
                <p className="text-slate-800 whitespace-pre-line mb-4">{post.content}</p>

                {post.imageUrl && (
                  <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-full max-h-[520px] object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                {(post.externalLink || post.videoUrl || post.attachmentUrl) && (
                  <div className="mb-4 flex flex-wrap gap-2 text-sm">
                    {post.externalLink && (
                      <a href={post.externalLink} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                        External Link
                      </a>
                    )}
                    {post.videoUrl && (
                      <a href={post.videoUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                        Video
                      </a>
                    )}
                    {post.attachmentUrl && (
                      <>
                        <a href={post.attachmentUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                          {isPdfFile(post.attachmentUrl) ? 'View PDF' : 'View Attachment'}
                        </a>
                        <a href={post.attachmentUrl} download className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-emerald-700 hover:bg-emerald-100">
                          {isPdfFile(post.attachmentUrl) ? 'Download PDF' : 'Download Attachment'}
                        </a>
                      </>
                    )}
                  </div>
                )}

                <div className="text-sm text-slate-600 flex items-center gap-4">
                  <span>{post.likes} likes</span>
                  <span>{post.replies} comments</span>
                  <span>{post.views} views</span>
                </div>
              </article>

              {!joined && !isAdmin && (
                <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span>Join this forum to comment and reply in this thread.</span>
                  <button type="button" onClick={handleJoinAndReturn} className="bg-amber-500 text-white px-3 py-2 rounded-md hover:bg-amber-600 text-sm font-semibold">
                    Join Forum
                  </button>
                </div>
              )}

              <section className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
                <h2 className="text-base font-semibold text-slate-900 mb-3">Add Comment</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Ask anything, suggest, or share your thoughts"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={postingComment}
                    onClick={handleSubmitComment}
                    className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {postingComment ? 'Posting...' : 'Comment'}
                  </button>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-xl p-4">
                <h2 className="text-base font-semibold text-slate-900 mb-2">Discussion ({comments.length})</h2>
                {comments.length === 0 && (
                  <p className="text-sm text-slate-600">No comments yet. Start this thread.</p>
                )}
                <div className="space-y-2">
                  {comments.map((comment) => renderComment(comment))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default PostDetail;
