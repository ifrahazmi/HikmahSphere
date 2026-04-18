import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  UserGroupIcon,
  ChatBubbleLeftIcon,
  TrophyIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { API_URL } from '../config';
import PageSEO from '../components/PageSEO';
import IslamicGames from '../components/IslamicGames';
import { useAuth } from '../hooks/useAuth';
import { generateGoogleMapsDirectionsUrl } from '../utils/maps';

type Forum = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags?: string[];
  members: number;
  posts: number;
  lastActivity: string;
  coverImageUrl?: string | null;
  externalLink?: string | null;
  videoUrl?: string | null;
  attachmentUrl?: string | null;
  createdByName?: string | null;
};

type CommunityPost = {
  id: string;
  title: string;
  content: string;
  forumId: string;
  tags?: string[];
  author: {
    username: string;
  };
  likes: number;
  replies: number;
  createdAt: string;
  imageUrl?: string | null;
  externalLink?: string | null;
  videoUrl?: string | null;
  attachmentUrl?: string | null;
};

type Event = {
  id: string;
  title: string;
  description: string;
  type: string;
  date: string;
  isOnline: boolean;
  attendees: number;
  maxCapacity: number | null;
  location: {
    name: string;
    address: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  tags?: string[];
};

type CommentItem = {
  id: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  author: {
    username: string;
  };
  replies: CommentItem[];
};

type AdminForumForm = {
  title: string;
  description: string;
  category: string;
  tags: string;
  externalLink: string;
  videoUrl: string;
  image: File | null;
  attachment: File | null;
};

type AdminPostForm = {
  title: string;
  content: string;
  forumId: string;
  tags: string;
  externalLink: string;
  videoUrl: string;
  image: File | null;
  attachment: File | null;
};

type AdminEventForm = {
  title: string;
  description: string;
  type: string;
  date: string;
  locationName: string;
  locationAddress: string;
  latitude: string;
  longitude: string;
  maxCapacity: string;
  isOnline: boolean;
  tags: string;
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
    return `${mins} min ago`;
  }
  if (diffMs < day) {
    const hours = Math.max(1, Math.floor(diffMs / hour));
    return `${hours} hr ago`;
  }

  const days = Math.max(1, Math.floor(diffMs / day));
  return `${days} day ago`;
};

const truncate = (text: string, max = 180): string => {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max).trim()}...`;
};

const Community: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const isFromLogin = tabParam === 'games';
  const [activeTab, setActiveTab] = useState(isFromLogin ? 'games' : 'forums');
  const [forums, setForums] = useState<Forum[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingForums, setLoadingForums] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForumModal, setShowCreateForumModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [creatingForum, setCreatingForum] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [editingForumId, setEditingForumId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [deletingForumId, setDeletingForumId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentItem[]>>({});
  const [loadingCommentsByPost, setLoadingCommentsByPost] = useState<Record<string, boolean>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [replyDraftByComment, setReplyDraftByComment] = useState<Record<string, string>>({});
  const [submittingCommentForPost, setSubmittingCommentForPost] = useState<string | null>(null);
  const [submittingReplyForComment, setSubmittingReplyForComment] = useState<string | null>(null);

  const [adminForumForm, setAdminForumForm] = useState<AdminForumForm>({
    title: '',
    description: '',
    category: '',
    tags: '',
    externalLink: '',
    videoUrl: '',
    image: null,
    attachment: null,
  });

  const [adminPostForm, setAdminPostForm] = useState<AdminPostForm>({
    title: '',
    content: '',
    forumId: '',
    tags: '',
    externalLink: '',
    videoUrl: '',
    image: null,
    attachment: null,
  });

  const [adminEventForm, setAdminEventForm] = useState<AdminEventForm>({
    title: '',
    description: '',
    type: 'lecture',
    date: '',
    locationName: '',
    locationAddress: '',
    latitude: '',
    longitude: '',
    maxCapacity: '',
    isOnline: false,
    tags: '',
  });

  // Set active tab based on URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'games') {
      setActiveTab('games');
    } else {
      setActiveTab('forums');
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchForums = async () => {
      setLoadingForums(true);
      try {
        const response = await axios.get(`${API_URL}/community/forums?limit=12`);
        setForums(response.data?.data?.forums || []);
      } catch {
        setError('Unable to load forums right now. Please try again shortly.');
      } finally {
        setLoadingForums(false);
      }
    };

    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        const response = await axios.get(`${API_URL}/community/posts?limit=8&sortBy=trending`);
        setPosts(response.data?.data?.posts || []);
      } catch {
        setError('Unable to load community posts right now.');
      } finally {
        setLoadingPosts(false);
      }
    };

    const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
        const response = await axios.get(`${API_URL}/community/events`);
        setEvents(response.data?.data?.events || []);
      } catch {
        setError('Unable to load events right now.');
      } finally {
        setLoadingEvents(false);
      }
    };

    void fetchForums();
    void fetchPosts();
    void fetchEvents();
  }, []);

  const isAdminOrManager = hasRole(['superadmin', 'manager']);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      return undefined;
    }
    return { Authorization: `Bearer ${token}` };
  };

  const refreshForums = async () => {
    setLoadingForums(true);
    try {
      const response = await axios.get(`${API_URL}/community/forums?limit=12`);
      setForums(response.data?.data?.forums || []);
    } catch {
      setError('Unable to refresh forums.');
    } finally {
      setLoadingForums(false);
    }
  };

  const refreshPosts = async () => {
    setLoadingPosts(true);
    try {
      const response = await axios.get(`${API_URL}/community/posts?limit=8&sortBy=trending`);
      setPosts(response.data?.data?.posts || []);
    } catch {
      setError('Unable to refresh posts.');
    } finally {
      setLoadingPosts(false);
    }
  };

  const refreshEvents = async () => {
    setLoadingEvents(true);
    try {
      const response = await axios.get(`${API_URL}/community/events`);
      setEvents(response.data?.data?.events || []);
    } catch {
      setError('Unable to refresh events.');
    } finally {
      setLoadingEvents(false);
    }
  };

  const openAuthForCommunityAction = (tab: 'forums' | 'posts' | 'events') => {
    navigate(`/auth?redirect=/community?tab=${tab}`);
  };

  const handleCreateForum = async (event: React.FormEvent) => {
    event.preventDefault();
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login as admin to create forum');
      openAuthForCommunityAction('forums');
      return;
    }

    setCreatingForum(true);
    try {
      const payload = new FormData();
      payload.append('title', adminForumForm.title);
      payload.append('description', adminForumForm.description);
      payload.append('category', adminForumForm.category);
      payload.append('tags', adminForumForm.tags);
      payload.append('externalLink', adminForumForm.externalLink);
      payload.append('videoUrl', adminForumForm.videoUrl);
      if (adminForumForm.image) payload.append('image', adminForumForm.image);
      if (adminForumForm.attachment) payload.append('attachment', adminForumForm.attachment);

      const response = editingForumId
        ? await axios.put(`${API_URL}/community/forums/${editingForumId}`, payload, { headers })
        : await axios.post(`${API_URL}/community/forums`, payload, {
            headers,
          });

      toast.success(response.data?.message || (editingForumId ? 'Forum updated successfully' : 'Forum created successfully'));
      setShowCreateForumModal(false);
      setEditingForumId(null);
      setAdminForumForm({
        title: '',
        description: '',
        category: '',
        tags: '',
        externalLink: '',
        videoUrl: '',
        image: null,
        attachment: null,
      });
      await refreshForums();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create forum');
    } finally {
      setCreatingForum(false);
    }
  };

  const handleCreatePost = async (event: React.FormEvent) => {
    event.preventDefault();
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login as admin to create post');
      openAuthForCommunityAction('posts');
      return;
    }

    setCreatingPost(true);
    try {
      const payload = new FormData();
      payload.append('title', adminPostForm.title);
      payload.append('content', adminPostForm.content);
      payload.append('forumId', adminPostForm.forumId);
      payload.append('tags', adminPostForm.tags);
      payload.append('externalLink', adminPostForm.externalLink);
      payload.append('videoUrl', adminPostForm.videoUrl);
      if (adminPostForm.image) payload.append('image', adminPostForm.image);
      if (adminPostForm.attachment) payload.append('attachment', adminPostForm.attachment);

      const response = editingPostId
        ? await axios.put(`${API_URL}/community/posts/${editingPostId}`, payload, { headers })
        : await axios.post(`${API_URL}/community/posts`, payload, {
            headers,
          });

      toast.success(response.data?.message || (editingPostId ? 'Post updated successfully' : 'Post created successfully'));
      setShowCreatePostModal(false);
      setEditingPostId(null);
      setAdminPostForm({
        title: '',
        content: '',
        forumId: '',
        tags: '',
        externalLink: '',
        videoUrl: '',
        image: null,
        attachment: null,
      });
      await refreshPosts();
      await refreshForums();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create post');
    } finally {
      setCreatingPost(false);
    }
  };

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login as admin to create event');
      openAuthForCommunityAction('events');
      return;
    }

    const normalizedDate = adminEventForm.date.trim();
    if (!normalizedDate) {
      toast.error('Please select event date and time');
      return;
    }

    const parsedLat = adminEventForm.latitude.trim().length > 0 ? Number(adminEventForm.latitude.trim()) : undefined;
    const parsedLng = adminEventForm.longitude.trim().length > 0 ? Number(adminEventForm.longitude.trim()) : undefined;

    if ((parsedLat !== undefined && Number.isNaN(parsedLat)) || (parsedLng !== undefined && Number.isNaN(parsedLng))) {
      toast.error('Latitude and longitude must be valid numbers');
      return;
    }
    if ((parsedLat === undefined) !== (parsedLng === undefined)) {
      toast.error('Please provide both latitude and longitude');
      return;
    }

    const parsedMaxCapacity = adminEventForm.maxCapacity.trim().length > 0
      ? Number(adminEventForm.maxCapacity.trim())
      : undefined;

    if (parsedMaxCapacity !== undefined && (!Number.isInteger(parsedMaxCapacity) || parsedMaxCapacity < 1)) {
      toast.error('Max capacity must be a whole number greater than 0');
      return;
    }

    setCreatingEvent(true);
    try {
      const payload: Record<string, unknown> = {
        title: adminEventForm.title,
        description: adminEventForm.description,
        type: adminEventForm.type,
        date: new Date(normalizedDate).toISOString(),
        isOnline: adminEventForm.isOnline,
        tags: adminEventForm.tags,
        location: {
          name: adminEventForm.locationName,
          address: adminEventForm.locationAddress,
          ...((parsedLat !== undefined && parsedLng !== undefined)
            ? { coordinates: { lat: parsedLat, lng: parsedLng } }
            : {}),
        },
      };

      if (parsedMaxCapacity !== undefined) {
        payload.maxCapacity = parsedMaxCapacity;
      }

      const response = await axios.post(`${API_URL}/community/events`, payload, { headers });
      toast.success(response.data?.message || 'Event created successfully');
      setShowCreateEventModal(false);
      setAdminEventForm({
        title: '',
        description: '',
        type: 'lecture',
        date: '',
        locationName: '',
        locationAddress: '',
        latitude: '',
        longitude: '',
        maxCapacity: '',
        isOnline: false,
        tags: '',
      });
      await refreshEvents();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create event');
    } finally {
      setCreatingEvent(false);
    }
  };

  const openEditForumModal = (forum: Forum) => {
    setEditingForumId(forum.id);
    setAdminForumForm({
      title: forum.title || '',
      description: forum.description || '',
      category: forum.category || '',
      tags: Array.isArray(forum.tags) ? forum.tags.join(', ') : '',
      externalLink: forum.externalLink || '',
      videoUrl: forum.videoUrl || '',
      image: null,
      attachment: null,
    });
    setShowCreateForumModal(true);
  };

  const openEditPostModal = (post: CommunityPost) => {
    setEditingPostId(post.id);
    setAdminPostForm({
      title: post.title || '',
      content: post.content || '',
      forumId: post.forumId || '',
      tags: Array.isArray(post.tags) ? post.tags.join(', ') : '',
      externalLink: post.externalLink || '',
      videoUrl: post.videoUrl || '',
      image: null,
      attachment: null,
    });
    setShowCreatePostModal(true);
  };

  const handleDeleteForum = async (forum: Forum) => {
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login as admin to delete forum');
      openAuthForCommunityAction('forums');
      return;
    }

    const confirmed = window.confirm(`Delete forum "${forum.title}" and all its posts/comments?`);
    if (!confirmed) {
      return;
    }

    setDeletingForumId(forum.id);
    try {
      const response = await axios.delete(`${API_URL}/community/forums/${forum.id}`, { headers });
      toast.success(response.data?.message || 'Forum deleted successfully');
      await Promise.all([refreshForums(), refreshPosts()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete forum');
    } finally {
      setDeletingForumId(null);
    }
  };

  const handleDeletePost = async (post: CommunityPost) => {
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login as admin to delete post');
      openAuthForCommunityAction('posts');
      return;
    }

    const confirmed = window.confirm(`Delete post "${post.title}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingPostId(post.id);
    try {
      const response = await axios.delete(`${API_URL}/community/posts/${post.id}`, { headers });
      toast.success(response.data?.message || 'Post deleted successfully');
      await Promise.all([refreshPosts(), refreshForums()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete post');
    } finally {
      setDeletingPostId(null);
    }
  };

  const fetchCommentsForPost = async (postId: string) => {
    setLoadingCommentsByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      const response = await axios.get(`${API_URL}/community/posts/${postId}/comments?limit=100`);
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: response.data?.data?.comments || [],
      }));
    } catch {
      toast.error('Unable to load comments');
    } finally {
      setLoadingCommentsByPost((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleCommentSubmit = async (postId: string) => {
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login to comment');
      openAuthForCommunityAction('posts');
      return;
    }

    const content = (commentDraftByPost[postId] || '').trim();
    if (!content) {
      toast.error('Please write a comment first');
      return;
    }

    setSubmittingCommentForPost(postId);
    try {
      await axios.post(`${API_URL}/community/posts/${postId}/comments`, { content }, { headers });
      setCommentDraftByPost((prev) => ({ ...prev, [postId]: '' }));
      await fetchCommentsForPost(postId);
      await refreshPosts();
      toast.success('Comment posted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to post comment');
    } finally {
      setSubmittingCommentForPost(null);
    }
  };

  const handleReplySubmit = async (postId: string, commentId: string) => {
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login to reply');
      openAuthForCommunityAction('posts');
      return;
    }

    const content = (replyDraftByComment[commentId] || '').trim();
    if (!content) {
      toast.error('Please write a reply first');
      return;
    }

    setSubmittingReplyForComment(commentId);
    try {
      await axios.post(`${API_URL}/community/comments/${commentId}/replies`, { content }, { headers });
      setReplyDraftByComment((prev) => ({ ...prev, [commentId]: '' }));
      await fetchCommentsForPost(postId);
      await refreshPosts();
      toast.success('Reply posted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to post reply');
    } finally {
      setSubmittingReplyForComment(null);
    }
  };

  const upcomingEvents = useMemo(() => {
    return [...events]
      .filter((event) => new Date(event.date).getTime() >= Date.now())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const tabs = [
    { id: 'forums', name: 'Forums', icon: ChatBubbleLeftIcon },
    { id: 'posts', name: 'Recent Posts', icon: UserGroupIcon },
    { id: 'events', name: 'Events', icon: CalendarDaysIcon },
    { id: 'games', name: 'Games', icon: TrophyIcon },
  ];

  const renderLoadingCards = (count: number) => {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-emerald-100 animate-pulse">
            <div className="h-5 w-1/2 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-full bg-gray-100 rounded mb-2" />
            <div className="h-4 w-3/4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  };

  const renderEmptyState = (message: string) => {
    return (
      <div className="bg-white rounded-xl border border-dashed border-emerald-200 p-8 text-center">
        <p className="text-gray-600">{message}</p>
      </div>
    );
  };

  const getTypeBadgeClass = (type: string): string => {
    switch (type) {
      case 'lecture':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'charity':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'study':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'iftar':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <>
      <PageSEO
        title="Muslim Community"
        description="Join Islamic forums, community discussions, events, and learning games with Muslims worldwide."
        path="/community"
        keywords={[
          'muslim community app',
          'muslim community online',
          'islamic discussion forum',
          'quran study circle',
          'muslim events',
          'hikmahsphere community',
        ]}
      />
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Global Muslim Community</h1>
          <p className="text-gray-600">Join discussions, discover events, and grow together with the Ummah.</p>
        </div>

        {isAdminOrManager && (
          <div className="mb-6 bg-white border border-emerald-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-emerald-700 font-semibold">Admin Publishing Controls</p>
              <p className="text-xs text-gray-500">Create high-quality forums, posts, and events visible to global visitors.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingForumId(null);
                  setAdminForumForm({
                    title: '',
                    description: '',
                    category: '',
                    tags: '',
                    externalLink: '',
                    videoUrl: '',
                    image: null,
                    attachment: null,
                  });
                  setShowCreateForumModal(true);
                }}
                className="inline-flex items-center gap-1 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Create Forum
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingPostId(null);
                  setAdminPostForm({
                    title: '',
                    content: '',
                    forumId: '',
                    tags: '',
                    externalLink: '',
                    videoUrl: '',
                    image: null,
                    attachment: null,
                  });
                  setShowCreatePostModal(true);
                }}
                className="inline-flex items-center gap-1 bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Create Post
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminEventForm({
                    title: '',
                    description: '',
                    type: 'lecture',
                    date: '',
                    locationName: '',
                    locationAddress: '',
                    latitude: '',
                    longitude: '',
                    maxCapacity: '',
                    isOnline: false,
                    tags: '',
                  });
                  setShowCreateEventModal(true);
                }}
                className="inline-flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Create Event
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Forums Tab */}
        {activeTab === 'forums' && (
          <div className="space-y-4">
            {loadingForums && renderLoadingCards(3)}
            {!loadingForums && forums.length === 0 && renderEmptyState('No forums available yet. Be the first to create community activity this week.')}
            {!loadingForums && forums.map((forum) => (
              <div key={forum.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{forum.title}</h3>
                    <p className="text-gray-600 mb-4">{forum.description}</p>
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <span className="flex items-center">
                        <UserGroupIcon className="h-4 w-4 mr-1" />
                        {forum.members.toLocaleString()} members
                      </span>
                      <span className="flex items-center">
                        <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                        {forum.posts.toLocaleString()} posts
                      </span>
                      <span>Last activity: {formatRelativeTime(forum.lastActivity)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isAdminOrManager && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForumModal(forum)}
                          className="bg-amber-500 text-white px-3 py-1.5 rounded-md hover:bg-amber-600 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingForumId === forum.id}
                          onClick={() => handleDeleteForum(forum)}
                          className="bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 text-sm disabled:opacity-60"
                        >
                          {deletingForumId === forum.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}

                    <Link
                      to={`/community/forums/${forum.id}`}
                      className="bg-slate-700 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors"
                    >
                      Open Forum
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Posts Tab */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {loadingPosts && renderLoadingCards(4)}
            {!loadingPosts && posts.length === 0 && renderEmptyState('No posts yet. Start the first beneficial discussion and inspire others.')}
            {!loadingPosts && posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{post.title}</h3>
                    <p className="text-sm text-gray-500">by {post.author.username} • {formatRelativeTime(post.createdAt)}</p>
                  </div>
                  {isAdminOrManager && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditPostModal(post)}
                        className="bg-amber-500 text-white px-3 py-1.5 rounded-md hover:bg-amber-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingPostId === post.id}
                        onClick={() => handleDeletePost(post)}
                        className="bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 text-sm disabled:opacity-60"
                      >
                        {deletingPostId === post.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-gray-700 mb-4">{truncate(post.content)}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{post.replies} replies</span>
                  <span>{post.likes} likes</span>
                  <Link
                    to={`/community/forums/${post.forumId}/posts/${post.id}`}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    Open Thread
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      const isSame = expandedPostId === post.id;
                      if (isSame) {
                        setExpandedPostId(null);
                        return;
                      }
                      setExpandedPostId(post.id);
                      await fetchCommentsForPost(post.id);
                    }}
                    className="text-slate-600 hover:text-slate-800"
                  >
                    {expandedPostId === post.id ? 'Hide Preview' : 'Quick Preview'}
                  </button>
                </div>

                {expandedPostId === post.id && (
                  <div className="mt-5 border-t border-gray-100 pt-4 space-y-4">
                    <h4 className="font-semibold text-gray-800">Discussion</h4>

                    {loadingCommentsByPost[post.id] && (
                      <p className="text-sm text-gray-500">Loading comments...</p>
                    )}

                    {!loadingCommentsByPost[post.id] && (commentsByPost[post.id] || []).length === 0 && (
                      <p className="text-sm text-gray-500">No comments yet. Start a beneficial discussion.</p>
                    )}

                    {(commentsByPost[post.id] || []).map((comment) => (
                      <div key={comment.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-sm font-semibold text-gray-800">{comment.author.username}</p>
                        <p className="text-xs text-gray-500 mb-2">{formatRelativeTime(comment.createdAt)}</p>
                        <p className="text-sm text-gray-700 mb-3">{comment.content}</p>

                        <div className="space-y-2 pl-3 border-l border-emerald-100 mb-2">
                          {comment.replies?.map((reply) => (
                            <div key={reply.id}>
                              <p className="text-xs font-semibold text-gray-700">{reply.author.username}</p>
                              <p className="text-xs text-gray-500 mb-1">{formatRelativeTime(reply.createdAt)}</p>
                              <p className="text-sm text-gray-700">{reply.content}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={replyDraftByComment[comment.id] || ''}
                            onChange={(event) => setReplyDraftByComment((prev) => ({
                              ...prev,
                              [comment.id]: event.target.value,
                            }))}
                            placeholder="Write a reply"
                            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            disabled={submittingReplyForComment === comment.id}
                            onClick={() => handleReplySubmit(post.id, comment.id)}
                            className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {submittingReplyForComment === comment.id ? 'Posting...' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentDraftByPost[post.id] || ''}
                        onChange={(event) => setCommentDraftByPost((prev) => ({
                          ...prev,
                          [post.id]: event.target.value,
                        }))}
                        placeholder="Add comment, ask question, or share suggestion"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        disabled={submittingCommentForPost === post.id}
                        onClick={() => handleCommentSubmit(post.id)}
                        className="rounded-md bg-teal-600 text-white px-3 py-2 text-sm hover:bg-teal-700 disabled:opacity-60"
                      >
                        {submittingCommentForPost === post.id ? 'Posting...' : 'Comment'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            {loadingEvents && renderLoadingCards(3)}
            {!loadingEvents && upcomingEvents.length === 0 && renderEmptyState('No upcoming events yet. Community organizers can start adding gatherings soon.')}
            {!loadingEvents && upcomingEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${getTypeBadgeClass(event.type)}`}>
                        {event.type}
                      </span>
                      {event.isOnline && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-teal-200 bg-teal-100 text-teal-700 text-xs font-semibold">
                          Online
                        </span>
                      )}
                    </div>

                    <p className="text-gray-700 mb-4">{truncate(event.description, 220)}</p>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        {new Date(event.date).toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPinIcon className="h-4 w-4" />
                        {event.location?.name || 'Community venue'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UserGroupIcon className="h-4 w-4" />
                        {event.attendees} attending
                        {event.maxCapacity ? ` / ${event.maxCapacity}` : ''}
                      </span>
                    </div>
                  </div>

                  <a
                    href={generateGoogleMapsDirectionsUrl(event.location)}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors h-fit"
                  >
                    Get Directions
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Games Tab */}
        {activeTab === 'games' && (
          <IslamicGames />
        )}

        {/* Islamic Quote */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-lg font-arabic text-gray-700 mb-2">
            "وَالْمُؤْمِنُونَ وَالْمُؤْمِنَاتُ بَعْضُهُمْ أَوْلِيَاءُ بَعْضٍ"
          </p>
          <p className="text-sm text-gray-500 italic">
            "The believing men and believing women are allies of one another"
          </p>
          <p className="text-xs text-gray-400 mt-2">- Quran 9:71</p>
        </div>
      </div>

      {showCreateForumModal && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowCreateForumModal(false);
            setEditingForumId(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">{editingForumId ? 'Edit Forum' : 'Create Forum'}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForumModal(false);
                  setEditingForumId(null);
                }}
                className="p-1 rounded hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateForum} className="p-4 space-y-4">
              <input required value={adminForumForm.title} onChange={(event) => setAdminForumForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Forum title" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              <textarea required value={adminForumForm.description} onChange={(event) => setAdminForumForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Forum description" rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              <input required value={adminForumForm.category} onChange={(event) => setAdminForumForm((prev) => ({ ...prev, category: event.target.value }))} placeholder="Category (example: Education)" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              <input value={adminForumForm.tags} onChange={(event) => setAdminForumForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder="Hashtags/tags comma-separated" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              <input value={adminForumForm.externalLink} onChange={(event) => setAdminForumForm((prev) => ({ ...prev, externalLink: event.target.value }))} placeholder="External link URL (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              <input value={adminForumForm.videoUrl} onChange={(event) => setAdminForumForm((prev) => ({ ...prev, videoUrl: event.target.value }))} placeholder="YouTube or video URL (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2" />

              <div>
                <p className="text-sm text-gray-700 mb-1">Add Image</p>
                <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => setAdminForumForm((prev) => ({ ...prev, image: event.target.files?.[0] || null }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <p className="text-sm text-gray-700 mb-1">Add PDF Attachment</p>
                <input type="file" accept=".pdf" onChange={(event) => setAdminForumForm((prev) => ({ ...prev, attachment: event.target.files?.[0] || null }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <button type="submit" disabled={creatingForum} className="w-full bg-emerald-600 text-white py-2.5 rounded-md hover:bg-emerald-700 disabled:opacity-60">
                {creatingForum ? (editingForumId ? 'Updating Forum...' : 'Creating Forum...') : (editingForumId ? 'Update Forum' : 'Publish Forum')}
              </button>
            </form>
          </div>
        </div>
      )}

      {showCreatePostModal && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowCreatePostModal(false);
            setEditingPostId(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">{editingPostId ? 'Edit Post' : 'Create Post'}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreatePostModal(false);
                  setEditingPostId(null);
                }}
                className="p-1 rounded hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="p-4 space-y-4">
              <input required value={adminPostForm.title} onChange={(event) => setAdminPostForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Post title" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              <textarea required value={adminPostForm.content} onChange={(event) => setAdminPostForm((prev) => ({ ...prev, content: event.target.value }))} placeholder="Post description/content" rows={5} className="w-full rounded-md border border-gray-300 px-3 py-2" />

              <select required value={adminPostForm.forumId} onChange={(event) => setAdminPostForm((prev) => ({ ...prev, forumId: event.target.value }))} className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="">Select forum</option>
                {forums.map((forum) => (
                  <option key={forum.id} value={forum.id}>{forum.title}</option>
                ))}
              </select>

              <input value={adminPostForm.tags} onChange={(event) => setAdminPostForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder="Hashtags/tags comma-separated" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              <input value={adminPostForm.externalLink} onChange={(event) => setAdminPostForm((prev) => ({ ...prev, externalLink: event.target.value }))} placeholder="External link URL (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              <input value={adminPostForm.videoUrl} onChange={(event) => setAdminPostForm((prev) => ({ ...prev, videoUrl: event.target.value }))} placeholder="YouTube or video URL (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2" />

              <div>
                <p className="text-sm text-gray-700 mb-1">Add Image</p>
                <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => setAdminPostForm((prev) => ({ ...prev, image: event.target.files?.[0] || null }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <p className="text-sm text-gray-700 mb-1">Add PDF Attachment</p>
                <input type="file" accept=".pdf" onChange={(event) => setAdminPostForm((prev) => ({ ...prev, attachment: event.target.files?.[0] || null }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <button type="submit" disabled={creatingPost} className="w-full bg-teal-600 text-white py-2.5 rounded-md hover:bg-teal-700 disabled:opacity-60">
                {creatingPost ? (editingPostId ? 'Updating Post...' : 'Creating Post...') : (editingPostId ? 'Update Post' : 'Publish Post')}
              </button>
            </form>
          </div>
        </div>
      )}

      {showCreateEventModal && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowCreateEventModal(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">Create Event</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateEventModal(false);
                }}
                className="p-1 rounded hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-4 space-y-4">
              <input
                required
                value={adminEventForm.title}
                onChange={(event) => setAdminEventForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Event title"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />

              <textarea
                required
                value={adminEventForm.description}
                onChange={(event) => setAdminEventForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Event description"
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  required
                  value={adminEventForm.type}
                  onChange={(event) => setAdminEventForm((prev) => ({ ...prev, type: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="prayer">Prayer</option>
                  <option value="iftar">Iftar</option>
                  <option value="lecture">Lecture</option>
                  <option value="study">Study Circle</option>
                  <option value="charity">Charity</option>
                  <option value="social">Social</option>
                </select>

                <input
                  required
                  type="datetime-local"
                  value={adminEventForm.date}
                  onChange={(event) => setAdminEventForm((prev) => ({ ...prev, date: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <input
                required
                value={adminEventForm.locationName}
                onChange={(event) => setAdminEventForm((prev) => ({ ...prev, locationName: event.target.value }))}
                placeholder="Location name (Masjid, hall, venue)"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />

              <input
                required
                value={adminEventForm.locationAddress}
                onChange={(event) => setAdminEventForm((prev) => ({ ...prev, locationAddress: event.target.value }))}
                placeholder="Full location address"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={adminEventForm.latitude}
                  onChange={(event) => setAdminEventForm((prev) => ({ ...prev, latitude: event.target.value }))}
                  placeholder="Latitude (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <input
                  value={adminEventForm.longitude}
                  onChange={(event) => setAdminEventForm((prev) => ({ ...prev, longitude: event.target.value }))}
                  placeholder="Longitude (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={adminEventForm.maxCapacity}
                  onChange={(event) => setAdminEventForm((prev) => ({ ...prev, maxCapacity: event.target.value }))}
                  placeholder="Max capacity (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <input
                  value={adminEventForm.tags}
                  onChange={(event) => setAdminEventForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="Tags comma-separated (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={adminEventForm.isOnline}
                  onChange={(event) => setAdminEventForm((prev) => ({ ...prev, isOnline: event.target.checked }))}
                  className="rounded border-gray-300"
                />
                This is an online event
              </label>

              <button type="submit" disabled={creatingEvent} className="w-full bg-blue-600 text-white py-2.5 rounded-md hover:bg-blue-700 disabled:opacity-60">
                {creatingEvent ? 'Creating Event...' : 'Publish Event'}
              </button>
            </form>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default Community;
