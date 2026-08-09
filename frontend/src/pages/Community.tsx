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
  VideoCameraIcon,
  ShareIcon,
  BellAlertIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { API_URL } from '../config';
import PageSEO from '../components/PageSEO';
import IslamicGames from '../components/IslamicGames';
import { useAuth } from '../hooks/useAuth';
import { generateGoogleMapsDirectionsUrl } from '../utils/maps';

// Matches the backend multer limit (MAX_COMMUNITY_UPLOAD_BYTES) so oversized
// files are caught before upload instead of failing server-side.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const formatFileSize = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const wallTimeToUtcIso = (dateTimeLocal: string, timeZone: string): string => {
  const [datePart, timePart = '00:00'] = dateTimeLocal.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const utcGuess = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(utcGuess));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  const asIfInZone = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour') % 24, read('minute'), read('second'));
  return new Date(utcGuess - (asIfInZone - utcGuess)).toISOString();
};

const utcToDatetimeLocal = (iso: string, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(iso));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '00';
  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}`;
};

const formatMeetingWhen = (iso: string, timeZone?: string): string =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timeZone || undefined,
  });

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

type Meeting = {
  id: string;
  title: string;
  description: string;
  topic: string;
  speakerName: string;
  platform: 'google_meet' | 'zoom' | 'teams' | 'jitsi' | 'other';
  meetingUrl?: string | null;
  meetingId?: string | null;
  passcode?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  recurrence: 'none' | 'weekly' | 'biweekly';
  status: 'scheduled' | 'completed' | 'canceled';
  organizer: {
    id: string;
    name: string;
    verified: boolean;
  };
  attendees: number;
  isJoined: boolean;
  responseStatus: 'joined' | 'not_going' | 'none';
  myDeclineReason?: string | null;
  declinedCount: number;
  joinClickCount: number;
  rsvpedUsers?: Array<{
    userId: string;
    name: string;
  }>;
  declinedUsers?: Array<{
    userId: string;
    name: string;
    reason: string;
    respondedAt: string;
  }>;
  joinClickUsers?: Array<{
    userId: string;
    name: string;
    firstJoinedAt: string;
    lastJoinedAt: string;
    joinCount: number;
  }>;
  maxCapacity: number | null;
  tags?: string[];
  notesLinks?: string[];
  attachment?: {
    url: string;
    name: string;
    mimeType: string;
    size: number;
  } | null;
  notificationConfig?: {
    enabled: boolean;
    channels: Array<'push' | 'email'>;
    reminderMinutes: number[];
    mode: 'once' | 'multiple';
    audience: 'all_registered' | 'rsvped_only';
    allowManualSendToAll: boolean;
  };
};

type MeetingNotificationSettings = {
  defaults: {
    enabled: boolean;
    channels: Array<'push' | 'email'>;
    reminderMinutes: number[];
    mode: 'once' | 'multiple';
    audience: 'all_registered' | 'rsvped_only';
  };
  emailTemplate: {
    subjectPrefix: string;
    logoUrl: string;
    headerTitle: string;
    footerText: string;
    includeAdvertisement: boolean;
    advertisementText?: string;
  };
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

type LocationSuggestion = {
  displayName: string;
  lat: string;
  lon: string;
};

type AdminMeetingForm = {
  title: string;
  description: string;
  topic: string;
  speakerName: string;
  platform: 'google_meet' | 'zoom' | 'teams' | 'jitsi' | 'other';
  meetingUrl: string;
  meetingId: string;
  passcode: string;
  scheduledAt: string;
  durationMinutes: string;
  timezone: string;
  recurrence: 'none' | 'weekly' | 'biweekly';
  maxCapacity: string;
  tags: string;
  notesLinks: string;
  attachment: File | null;
};

type MeetingFieldErrors = Partial<Record<
  'title' | 'description' | 'topic' | 'speakerName' | 'meetingUrl' | 'meetingId' | 'scheduledAt' | 'durationMinutes' | 'timezone' | 'recurrence' | 'maxCapacity' | 'attachment',
  string
>>;

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

const formatMeetingCountdown = (scheduledAt: string): string => {
  const meetingTime = new Date(scheduledAt).getTime();
  if (Number.isNaN(meetingTime)) {
    return 'Schedule unavailable';
  }

  const diffMs = meetingTime - Date.now();
  if (diffMs <= 0) {
    return 'Live now';
  }

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
};

const formatPlatformName = (platform: Meeting['platform']): string => {
  switch (platform) {
    case 'google_meet':
      return 'Google Meet';
    case 'zoom':
      return 'Zoom';
    case 'teams':
      return 'Microsoft Teams';
    case 'jitsi':
      return 'Jitsi';
    default:
      return 'Online Meeting';
  }
};

const ALLOWED_COMMUNITY_TABS = ['forums', 'posts', 'events', 'meetings', 'games'];

const Community: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = ALLOWED_COMMUNITY_TABS.includes(tabParam || '') ? (tabParam as string) : 'forums';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [forums, setForums] = useState<Forum[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingForums, setLoadingForums] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForumModal, setShowCreateForumModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false);
  const [creatingForum, setCreatingForum] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [editingForumId, setEditingForumId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [deletingForumId, setDeletingForumId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [cancelingMeetingId, setCancelingMeetingId] = useState<string | null>(null);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [highlightMeetingId, setHighlightMeetingId] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentItem[]>>({});
  const [loadingCommentsByPost, setLoadingCommentsByPost] = useState<Record<string, boolean>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [replyDraftByComment, setReplyDraftByComment] = useState<Record<string, string>>({});
  const [submittingCommentForPost, setSubmittingCommentForPost] = useState<string | null>(null);
  const [submittingReplyForComment, setSubmittingReplyForComment] = useState<string | null>(null);
  const [rsvpLoadingMeetingId, setRsvpLoadingMeetingId] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineMeeting, setDeclineMeeting] = useState<Meeting | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [showMeetingResponsesModal, setShowMeetingResponsesModal] = useState(false);
  const [responseViewerMeeting, setResponseViewerMeeting] = useState<Meeting | null>(null);
  const [meetingFieldErrors, setMeetingFieldErrors] = useState<MeetingFieldErrors>({});
  const [meetingFormErrorSummary, setMeetingFormErrorSummary] = useState<string[]>([]);
  const [showMeetingNotificationModal, setShowMeetingNotificationModal] = useState(false);
  const [meetingNotificationSettings, setMeetingNotificationSettings] = useState<MeetingNotificationSettings | null>(null);
  const [savingMeetingNotificationSettings, setSavingMeetingNotificationSettings] = useState(false);
  const [sendingMeetingNotification, setSendingMeetingNotification] = useState<string | null>(null);

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

  const [adminMeetingForm, setAdminMeetingForm] = useState<AdminMeetingForm>({
    title: '',
    description: '',
    topic: '',
    speakerName: '',
    platform: 'google_meet',
    meetingUrl: '',
    meetingId: '',
    passcode: '',
    scheduledAt: '',
    durationMinutes: '60',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    recurrence: 'none',
    maxCapacity: '',
    tags: '',
    notesLinks: '',
    attachment: null,
  });
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  // Set active tab based on URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ALLOWED_COMMUNITY_TABS.includes(tab)) {
      setActiveTab(tab);
      return;
    }
    setActiveTab('forums');
  }, [searchParams]);

  useEffect(() => {
    const meetingIdParam = searchParams.get('meetingId');
    if (!meetingIdParam) {
      return;
    }
    setActiveTab('meetings');
    setHighlightMeetingId(meetingIdParam);
  }, [searchParams]);

  useEffect(() => {
    if (!highlightMeetingId || activeTab !== 'meetings') {
      return;
    }
    const element = document.getElementById(`meeting-card-${highlightMeetingId}`);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeout = window.setTimeout(() => {
      setHighlightMeetingId(null);
    }, 2500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [highlightMeetingId, activeTab, meetings]);

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

    const fetchMeetings = async () => {
      const headers = getAuthHeaders();
      if (!headers) {
        setMeetings([]);
        return;
      }

      setLoadingMeetings(true);
      try {
        const response = await axios.get(`${API_URL}/community/meetings`, { headers });
        setMeetings(response.data?.data?.meetings || []);
      } catch {
        setError('Unable to load meetings right now.');
      } finally {
        setLoadingMeetings(false);
      }
    };

    void fetchForums();
    void fetchPosts();
    void fetchEvents();
    void fetchMeetings();
  }, [user?.id]);

  const isAdminOrManager = hasRole(['superadmin', 'manager']) || Boolean(user?.isAdmin);
  const isSuperAdmin = hasRole(['superadmin']) || Boolean(user?.isAdmin && user?.role === 'superadmin');

  useEffect(() => {
    if (isAdminOrManager) {
      void fetchMeetingNotificationSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrManager]);

  useEffect(() => {
    if (!showCreateEventModal) {
      return;
    }

    const query = adminEventForm.locationAddress.trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setLoadingLocationSuggestions(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      const loadSuggestions = async () => {
        setLoadingLocationSuggestions(true);
        try {
          const toSuggestions = (results: any[]): LocationSuggestion[] => (
            Array.isArray(results)
              ? results
                  .map((item: any) => ({
                    displayName: String(item?.display_name || '').trim(),
                    lat: String(item?.lat || '').trim(),
                    lon: String(item?.lon || '').trim(),
                  }))
                  .filter((item) => item.displayName && item.lat && item.lon)
              : []
          );

          const indiaResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&addressdetails=1&limit=7&countrycodes=in&accept-language=en,en-IN`,
            {
              headers: {
                Accept: 'application/json',
              },
            }
          );

          if (!indiaResponse.ok) {
            setLocationSuggestions([]);
            return;
          }

          const indiaResults = await indiaResponse.json();
          const indiaSuggestions = toSuggestions(indiaResults);

          if (indiaSuggestions.length > 0) {
            setLocationSuggestions(indiaSuggestions);
            return;
          }

          // Fallback to global results when no India match is found.
          const globalResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&addressdetails=1&limit=7&accept-language=en,en-IN`,
            {
              headers: {
                Accept: 'application/json',
              },
            }
          );

          if (!globalResponse.ok) {
            setLocationSuggestions([]);
            return;
          }

          const globalResults = await globalResponse.json();
          setLocationSuggestions(toSuggestions(globalResults));
        } catch {
          setLocationSuggestions([]);
        } finally {
          setLoadingLocationSuggestions(false);
        }
      };

      void loadSuggestions();
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [adminEventForm.locationAddress, showCreateEventModal]);

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

  const refreshMeetings = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMeetings([]);
      return;
    }

    setLoadingMeetings(true);
    try {
      const response = await axios.get(`${API_URL}/community/meetings`, { headers });
      setMeetings(response.data?.data?.meetings || []);
    } catch {
      setError('Unable to refresh meetings.');
    } finally {
      setLoadingMeetings(false);
    }
  };

  const fetchMeetingNotificationSettings = async () => {
    const headers = getAuthHeaders();
    if (!headers || !isAdminOrManager) {
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/community/meeting-notification-settings`, { headers });
      setMeetingNotificationSettings(response.data?.data?.settings || null);
    } catch {
      toast.error('Unable to load meeting notification settings');
    }
  };

  const openAuthForCommunityAction = (tab: 'forums' | 'posts' | 'events' | 'meetings') => {
    navigate(`/auth?redirect=${encodeURIComponent(`/community?tab=${tab}`)}`);
  };

  const downloadMeetingAttachment = async (meeting: Meeting) => {
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login to download meeting material');
      openAuthForCommunityAction('meetings');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/community/meetings/${meeting.id}/attachment`, {
        headers,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Failed to download attachment');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = meeting.attachment?.name || 'meeting-material';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to download attachment');
    }
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
      setShowLocationSuggestions(false);
      setLocationSuggestions([]);
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

  const handleCreateMeeting = async (event: React.FormEvent) => {
    event.preventDefault();
    setMeetingFieldErrors({});
    setMeetingFormErrorSummary([]);

    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login as admin to publish meeting');
      openAuthForCommunityAction('meetings');
      return;
    }

    const normalizedDate = adminMeetingForm.scheduledAt.trim();
    if (!normalizedDate) {
      toast.error('Please select meeting date and time');
      return;
    }

    const parsedDuration = Number(adminMeetingForm.durationMinutes.trim());
    if (!Number.isInteger(parsedDuration) || parsedDuration < 10) {
      toast.error('Duration must be at least 10 minutes');
      return;
    }

    const parsedMaxCapacity = adminMeetingForm.maxCapacity.trim().length > 0
      ? Number(adminMeetingForm.maxCapacity.trim())
      : undefined;

    if (parsedMaxCapacity !== undefined && (!Number.isInteger(parsedMaxCapacity) || parsedMaxCapacity < 1)) {
      toast.error('Max capacity must be a whole number greater than 0');
      return;
    }

    if (!adminMeetingForm.meetingUrl.trim() && !adminMeetingForm.meetingId.trim()) {
      setMeetingFieldErrors({ meetingUrl: 'Provide meeting URL or meeting ID' });
      setMeetingFormErrorSummary(['Provide meeting URL or meeting ID']);
      toast.error('Please fix highlighted fields');
      return;
    }

    if (adminMeetingForm.attachment && adminMeetingForm.attachment.size > MAX_ATTACHMENT_BYTES) {
      const message = `Attachment is ${formatFileSize(adminMeetingForm.attachment.size)}. Maximum allowed is 10 MB.`;
      setMeetingFieldErrors({ attachment: message });
      setMeetingFormErrorSummary([message]);
      toast.error(message);
      return;
    }

    setCreatingMeeting(true);
    try {
      const payload = new FormData();
      payload.append('title', adminMeetingForm.title);
      payload.append('description', adminMeetingForm.description);
      payload.append('topic', adminMeetingForm.topic);
      payload.append('speakerName', adminMeetingForm.speakerName);
      payload.append('platform', adminMeetingForm.platform);
      payload.append('meetingUrl', adminMeetingForm.meetingUrl.trim());
      payload.append('meetingId', adminMeetingForm.meetingId.trim());
      payload.append('passcode', adminMeetingForm.passcode.trim());
      payload.append('scheduledAt', wallTimeToUtcIso(normalizedDate, adminMeetingForm.timezone));
      payload.append('durationMinutes', String(parsedDuration));
      payload.append('timezone', adminMeetingForm.timezone);
      payload.append('recurrence', adminMeetingForm.recurrence);
      payload.append('tags', adminMeetingForm.tags);
      payload.append('notesLinks', adminMeetingForm.notesLinks);

      if (parsedMaxCapacity !== undefined) {
        payload.append('maxCapacity', String(parsedMaxCapacity));
      }
      if (adminMeetingForm.attachment) {
        payload.append('attachment', adminMeetingForm.attachment);
      }

      const response = editingMeetingId
        ? await axios.put(`${API_URL}/community/meetings/${editingMeetingId}`, payload, { headers })
        : await axios.post(`${API_URL}/community/meetings`, payload, { headers });

      toast.success(response.data?.message || (editingMeetingId ? 'Meeting updated successfully' : 'Meeting published successfully'));
      setShowCreateMeetingModal(false);
      setEditingMeetingId(null);
      setAdminMeetingForm({
        title: '',
        description: '',
        topic: '',
        speakerName: '',
        platform: 'google_meet',
        meetingUrl: '',
        meetingId: '',
        passcode: '',
        scheduledAt: '',
        durationMinutes: '60',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        recurrence: 'none',
        maxCapacity: '',
        tags: '',
        notesLinks: '',
        attachment: null,
      });
      await refreshMeetings();
    } catch (err: any) {
      // nginx/server rejected the body as too large (or a proxy 413 with no JSON
      // body). Surface a clear attachment-specific message instead of a generic error.
      const status = err?.response?.status;
      if (status === 413 || /too large|entity too large|file too large/i.test(String(err?.response?.data?.message || ''))) {
        const message = 'Attachment is too large. Please upload a file up to 10 MB.';
        setMeetingFieldErrors({ attachment: message });
        setMeetingFormErrorSummary([message]);
        toast.error(message);
        return;
      }

      const responseErrors = Array.isArray(err?.response?.data?.errors) ? err.response.data.errors : [];
      const nextFieldErrors: MeetingFieldErrors = {};
      const nextSummary: string[] = [];

      responseErrors.forEach((item: any) => {
        const field = String(item?.field || '').trim();
        const message = String(item?.message || '').trim();
        if (!message) {
          return;
        }
        nextSummary.push(message);
        if (field === 'title') nextFieldErrors.title = message;
        if (field === 'description') nextFieldErrors.description = message;
        if (field === 'topic') nextFieldErrors.topic = message;
        if (field === 'speakerName') nextFieldErrors.speakerName = message;
        if (field === 'meetingUrl') nextFieldErrors.meetingUrl = message;
        if (field === 'meetingId') nextFieldErrors.meetingId = message;
        if (field === 'scheduledAt') nextFieldErrors.scheduledAt = message;
        if (field === 'durationMinutes') nextFieldErrors.durationMinutes = message;
        if (field === 'timezone') nextFieldErrors.timezone = message;
        if (field === 'recurrence') nextFieldErrors.recurrence = message;
        if (field === 'maxCapacity') nextFieldErrors.maxCapacity = message;
        if (field === 'attachment') nextFieldErrors.attachment = message;
      });

      if (nextSummary.length > 0) {
        setMeetingFieldErrors(nextFieldErrors);
        setMeetingFormErrorSummary(Array.from(new Set(nextSummary)));
        toast.error('Please fix highlighted fields');
      } else {
        toast.error(err?.response?.data?.message || 'Failed to publish meeting');
      }
    } finally {
      setCreatingMeeting(false);
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

  const openEditMeetingModal = (meeting: Meeting) => {
    setEditingMeetingId(meeting.id);
    setAdminMeetingForm({
      title: meeting.title || '',
      description: meeting.description || '',
      topic: meeting.topic || '',
      speakerName: meeting.speakerName || '',
      platform: meeting.platform || 'google_meet',
      meetingUrl: meeting.meetingUrl || '',
      meetingId: meeting.meetingId || '',
      passcode: meeting.passcode || '',
      scheduledAt: utcToDatetimeLocal(meeting.scheduledAt, meeting.timezone || 'UTC'),
      durationMinutes: String(meeting.durationMinutes || 60),
      timezone: meeting.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
      recurrence: meeting.recurrence || 'none',
      maxCapacity: meeting.maxCapacity ? String(meeting.maxCapacity) : '',
      tags: Array.isArray(meeting.tags) ? meeting.tags.join(', ') : '',
      notesLinks: Array.isArray(meeting.notesLinks) ? meeting.notesLinks.join(', ') : '',
      attachment: null,
    });
    setShowCreateMeetingModal(true);
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

  const handleCancelMeeting = async (meeting: Meeting) => {
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login as admin to cancel meeting');
      openAuthForCommunityAction('meetings');
      return;
    }

    const confirmed = window.confirm(`Cancel meeting "${meeting.title}"?`);
    if (!confirmed) {
      return;
    }

    setCancelingMeetingId(meeting.id);
    try {
      const response = await axios.delete(`${API_URL}/community/meetings/${meeting.id}`, { headers });
      toast.success(response.data?.message || 'Meeting canceled successfully');
      await refreshMeetings();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel meeting');
    } finally {
      setCancelingMeetingId(null);
    }
  };

  const handlePermanentDeleteMeeting = async (meeting: Meeting) => {
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login as admin to delete meeting');
      return;
    }

    const confirmed = window.confirm(`Permanently delete meeting "${meeting.title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingMeetingId(meeting.id);
    try {
      const response = await axios.delete(`${API_URL}/community/meetings/${meeting.id}/permanent`, { headers });
      toast.success(response.data?.message || 'Meeting removed from list');
      setMeetings((prev) => prev.filter((item) => item.id !== meeting.id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete meeting');
    } finally {
      setDeletingMeetingId(null);
    }
  };

  const handleMeetingRsvpJoin = async (meeting: Meeting) => {
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login to RSVP');
      openAuthForCommunityAction('meetings');
      return;
    }

    setRsvpLoadingMeetingId(meeting.id);
    try {
      const endpoint = meeting.isJoined || meeting.responseStatus === 'joined'
        ? `${API_URL}/community/meetings/${meeting.id}/leave`
        : `${API_URL}/community/meetings/${meeting.id}/rsvp`;
      const response = await axios.post(endpoint, {}, { headers });
      const updatedMeeting = response.data?.data?.meeting;
      if (updatedMeeting) {
        setMeetings((prev) => prev.map((item) => (item.id === meeting.id ? updatedMeeting : item)));
      }
      toast.success(
        meeting.isJoined || meeting.responseStatus === 'joined'
          ? 'RSVP removed'
          : 'RSVP confirmed'
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Unable to update RSVP');
    } finally {
      setRsvpLoadingMeetingId(null);
    }
  };

  const openDeclineModal = (meeting: Meeting) => {
    setDeclineMeeting(meeting);
    setDeclineReason((meeting.myDeclineReason || '').trim());
    setShowDeclineModal(true);
  };

  const closeDeclineModal = () => {
    setShowDeclineModal(false);
    setDeclineMeeting(null);
    setDeclineReason('');
  };

  const submitMeetingDecline = async () => {
    if (!declineMeeting) {
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login to update your response');
      openAuthForCommunityAction('meetings');
      return;
    }

    const reason = declineReason.trim();
    if (!reason) {
      toast.error('Please provide a reason for not attending');
      return;
    }

    setDeclineSubmitting(true);
    try {
      const response = await axios.post(
        `${API_URL}/community/meetings/${declineMeeting.id}/decline`,
        { reason },
        { headers }
      );
      setMeetings((prev) => prev.map((item) => (item.id === declineMeeting.id ? response.data?.data?.meeting : item)));
      toast.success('Not attending response saved');
      closeDeclineModal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Unable to save not attending response');
    } finally {
      setDeclineSubmitting(false);
    }
  };

  const handleJoinMeetingClick = (meeting: Meeting) => {
    if (!meeting.meetingUrl) {
      return;
    }

    window.open(meeting.meetingUrl, '_blank', 'noopener,noreferrer');

    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }

    void axios.post(`${API_URL}/community/meetings/${meeting.id}/join-click`, {}, { headers })
      .then((response) => {
        const updatedMeeting = response.data?.data?.meeting;
        if (!updatedMeeting) {
          return;
        }
        setMeetings((prev) => prev.map((item) => (item.id === meeting.id ? updatedMeeting : item)));
      })
      .catch(() => {
        // Tracking failures should never block the meeting join experience.
      });
  };

  const openMeetingResponsesViewer = (meeting: Meeting) => {
    setResponseViewerMeeting(meeting);
    setShowMeetingResponsesModal(true);
  };

  const copyMeetingDetails = async (meeting: Meeting) => {
    const lines = [
      `Topic: ${meeting.topic}`,
      `Speaker: ${meeting.speakerName}`,
      `When: ${new Date(meeting.scheduledAt).toLocaleString()} (${meeting.timezone})`,
      `Platform: ${formatPlatformName(meeting.platform)}`,
      meeting.meetingUrl ? `Join link: ${meeting.meetingUrl}` : '',
      meeting.meetingId ? `Meeting ID: ${meeting.meetingId}` : '',
      meeting.passcode ? `Passcode: ${meeting.passcode}` : '',
    ].filter(Boolean);

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Meeting details copied');
    } catch {
      toast.error('Unable to copy details on this browser');
    }
  };

  const getMeetingPageShareUrl = (meetingId: string): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/community?tab=meetings&meetingId=${meetingId}`;
  };

  const handleShareMeeting = async (meeting: Meeting) => {
    const shareUrl = getMeetingPageShareUrl(meeting.id);
    const shareTitle = `${meeting.title} - HikmahSphere Community Meeting`;
    const shareText = `${meeting.topic} by ${meeting.speakerName}. Join from HikmahSphere.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch {
        // Ignore and fallback to clipboard below.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Meeting page link copied');
    } catch {
      toast.error('Unable to share link on this browser');
    }
  };

  const handleShareMeetingWhatsApp = (meeting: Meeting) => {
    const shareUrl = getMeetingPageShareUrl(meeting.id);
    const text = encodeURIComponent(`Join this HikmahSphere meeting: ${meeting.title}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const saveMeetingNotificationSettings = async () => {
    const headers = getAuthHeaders();
    if (!headers || !meetingNotificationSettings) {
      return;
    }

    setSavingMeetingNotificationSettings(true);
    try {
      const response = await axios.put(
        `${API_URL}/community/meeting-notification-settings`,
        meetingNotificationSettings,
        { headers }
      );
      setMeetingNotificationSettings(response.data?.data?.settings || meetingNotificationSettings);
      toast.success('Meeting notification settings saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save notification settings');
    } finally {
      setSavingMeetingNotificationSettings(false);
    }
  };

  const sendMeetingNotificationNow = async (meeting: Meeting, audience: 'all_registered' | 'rsvped_only') => {
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error('Please login as admin/manager');
      return;
    }

    setSendingMeetingNotification(meeting.id);
    try {
      const response = await axios.post(
        `${API_URL}/community/meetings/${meeting.id}/send-notification`,
        {
          audience,
          channels: meeting.notificationConfig?.channels || meetingNotificationSettings?.defaults.channels || ['push', 'email'],
          note: 'Manual invite from HikmahSphere',
        },
        { headers }
      );

      const summary = response.data?.data?.summary;
      const pushSent = summary?.pushSent || 0;
      const emailSent = summary?.emailSent || 0;
      if (pushSent === 0 && emailSent === 0) {
        toast.error(response.data?.message || 'No notifications were delivered');
      } else {
        toast.success(`Sent now: push ${pushSent}, email ${emailSent}`);
      }
      await refreshMeetings();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send notifications now');
    } finally {
      setSendingMeetingNotification(null);
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

  const upcomingMeetings = useMemo(() => {
    return [...meetings]
      .filter((meeting) => meeting.status === 'scheduled' && new Date(meeting.scheduledAt).getTime() >= Date.now())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [meetings]);

  const pastMeetings = useMemo(() => {
    return [...meetings]
      .filter((meeting) => meeting.status !== 'scheduled' || new Date(meeting.scheduledAt).getTime() < Date.now())
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [meetings]);

  const nextMeeting = upcomingMeetings[0] || null;

  const tabs = [
    { id: 'forums', name: 'Forums', icon: ChatBubbleLeftIcon },
    { id: 'posts', name: 'Recent Posts', icon: UserGroupIcon },
    { id: 'events', name: 'Events', icon: CalendarDaysIcon },
    { id: 'meetings', name: 'Meetings', icon: VideoCameraIcon },
    { id: 'games', name: 'Games', icon: TrophyIcon },
  ];

  const tabDescriptionById: Record<string, string> = {
    forums: 'Study circles and focused spaces',
    posts: 'Fresh reflections and questions',
    events: 'Gatherings, lectures, and service',
    meetings: 'Live Quran sessions and RSVPs',
    games: 'Fun Islamic learning challenges',
  };

  const tabCountById: Record<string, number> = {
    forums: forums.length,
    posts: posts.length,
    events: upcomingEvents.length,
    meetings: upcomingMeetings.length,
    games: 1,
  };

  const communityOverviewStats = [
    {
      label: 'Forums',
      value: forums.length,
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Posts',
      value: posts.length,
      tone: 'border-teal-200 bg-teal-50 text-teal-700',
    },
    {
      label: 'Events',
      value: upcomingEvents.length,
      tone: 'border-sky-200 bg-sky-50 text-sky-700',
    },
    {
      label: 'Meetings',
      value: upcomingMeetings.length,
      tone: 'border-violet-200 bg-violet-50 text-violet-700',
    },
  ];

  const renderLoadingCards = (count: number) => {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-sm sm:p-6">
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
      <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/90 p-6 text-center shadow-sm sm:p-8">
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
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-emerald-50 via-white to-cyan-50 pt-16">
      <div className="mx-auto max-w-7xl px-4 pt-0 pb-6 sm:px-6 sm:pt-2 sm:pb-8 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[28px] border border-emerald-100/80 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="grid gap-5 px-5 py-5 sm:px-8 sm:py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                <UserGroupIcon className="h-4 w-4" />
                Global Muslim Community
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Grow in knowledge, service, and brotherhood together
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Join focused forums, beneficial posts, community events, and live Quran meetings in a cleaner mobile-friendly space built for the Ummah.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {communityOverviewStats.map((stat) => (
                <div key={stat.label} className={`rounded-2xl border px-4 py-4 shadow-sm ${stat.tone}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isAdminOrManager && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-white/90 shadow-sm">
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-5 py-5 text-white sm:px-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">Admin Publishing Controls</p>
                  <h2 className="mt-2 text-xl font-semibold">Publish community updates from one compact control panel</h2>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    Create forums, posts, events, and meetings with a layout that wraps cleanly on small screens and stays polished on larger displays.
                  </p>
                </div>

                <div className="grid w-full gap-2 sm:grid-cols-2 xl:grid-cols-5">
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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50"
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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-teal-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-50"
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
                      setShowLocationSuggestions(false);
                      setLocationSuggestions([]);
                      setShowCreateEventModal(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-sky-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Create Event
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMeetingId(null);
                      setMeetingFieldErrors({});
                      setMeetingFormErrorSummary([]);
                      setAdminMeetingForm({
                        title: '',
                        description: '',
                        topic: '',
                        speakerName: '',
                        platform: 'google_meet',
                        meetingUrl: '',
                        meetingId: '',
                        passcode: '',
                        scheduledAt: '',
                        durationMinutes: '60',
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                        recurrence: 'none',
                        maxCapacity: '',
                        tags: '',
                        notesLinks: '',
                        attachment: null,
                      });
                      setShowCreateMeetingModal(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-cyan-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Publish Meeting
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMeetingNotificationModal(true);
                      void fetchMeetingNotificationSettings();
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-50"
                  >
                    <BellAlertIcon className="h-4 w-4" />
                    Meeting Alerts Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="sticky top-20 z-20 mb-6">
          <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-white/80 bg-white/90 p-2 shadow-lg backdrop-blur-md sm:grid-cols-5">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const isLastMobileCard = index === tabs.length - 1;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-3 py-3 text-left transition ${
                    isLastMobileCard ? 'col-span-2 sm:col-span-1' : ''
                  } ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-emerald-300' : 'text-emerald-600'}`} />
                      <span className="text-sm font-semibold leading-tight">{tab.name}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      activeTab === tab.id
                        ? 'bg-white/10 text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200'
                    }`}>
                      {tabCountById[tab.id] ?? 0}
                    </span>
                  </span>
                  <span className={`mt-1 hidden text-xs leading-5 sm:block ${
                    activeTab === tab.id ? 'text-slate-200' : 'text-slate-500'
                  }`}>
                    {tabDescriptionById[tab.id]}
                  </span>
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
              <div key={forum.id} className="rounded-2xl border border-white bg-white/95 p-4 shadow-sm transition-all hover:shadow-lg sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{forum.title}</h3>
                    <p className="text-gray-600 mb-4">{forum.description}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500">
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
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                    {isAdminOrManager && (
                      <div className="flex flex-wrap gap-2 sm:justify-end">
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
                      className="inline-flex items-center justify-center rounded-xl bg-slate-700 px-4 py-2.5 text-white transition-colors hover:bg-slate-800"
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
              <div key={post.id} className="rounded-2xl border border-white bg-white/95 p-4 shadow-sm sm:p-6">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900">{post.title}</h3>
                    <p className="text-sm text-gray-500">by {post.author.username} • {formatRelativeTime(post.createdAt)}</p>
                  </div>
                  {isAdminOrManager && (
                    <div className="flex flex-wrap gap-2 sm:justify-end">
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
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
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

                        <div className="flex flex-col gap-2 sm:flex-row">
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

                    <div className="flex flex-col gap-2 sm:flex-row">
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
              <div key={event.id} className="rounded-2xl border border-white bg-white/95 p-4 shadow-sm sm:p-6">
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
                    className="h-fit w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-white transition-colors hover:bg-emerald-700 sm:w-auto"
                  >
                    Get Directions
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Meetings Tab */}
        {activeTab === 'meetings' && (
          <div className="space-y-5">
            {!getAuthHeaders() && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-800">Login required for meetings</p>
                  <p className="text-sm text-amber-700">Sign in to view join links, RSVP, and receive session updates.</p>
                </div>
                <button
                  type="button"
                  onClick={() => openAuthForCommunityAction('meetings')}
                  className="rounded-md bg-amber-600 text-white px-4 py-2 hover:bg-amber-700 w-full sm:w-auto"
                >
                  Login to Continue
                </button>
              </div>
            )}

            {getAuthHeaders() && loadingMeetings && renderLoadingCards(3)}

            {getAuthHeaders() && !loadingMeetings && nextMeeting && (
              <div className="rounded-2xl bg-gradient-to-r from-sky-700 via-cyan-700 to-teal-700 text-white p-6 shadow-lg">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100 mb-2">Next Quran Session</p>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{nextMeeting.title}</h3>
                    <p className="text-cyan-50 mb-3">{truncate(nextMeeting.description, 240)}</p>
                    <div className="flex flex-wrap gap-3 text-sm text-cyan-100">
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        {formatMeetingWhen(nextMeeting.scheduledAt, nextMeeting.timezone)} ({nextMeeting.timezone})
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UserGroupIcon className="h-4 w-4" />
                        {nextMeeting.attendees}{nextMeeting.maxCapacity ? ` / ${nextMeeting.maxCapacity}` : ''} RSVP
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <VideoCameraIcon className="h-4 w-4" />
                        {formatPlatformName(nextMeeting.platform)}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/15 border border-white/25 px-4 py-3 text-center min-w-[160px]">
                    <p className="text-xs uppercase tracking-wide text-cyan-100 mb-1">Starts in</p>
                    <p className="text-xl font-bold">{formatMeetingCountdown(nextMeeting.scheduledAt)}</p>
                  </div>
                </div>
              </div>
            )}

            {getAuthHeaders() && !loadingMeetings && upcomingMeetings.length === 0 && renderEmptyState('No upcoming meetings yet. Admin and manager can publish the next weekly dars here.')}

            {getAuthHeaders() && !loadingMeetings && upcomingMeetings.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Upcoming Meetings</h3>
                {upcomingMeetings.map((meeting) => (
                  <div
                    id={`meeting-card-${meeting.id}`}
                    key={meeting.id}
                    className={`rounded-2xl border bg-white/95 p-4 shadow-sm transition-all sm:p-5 ${highlightMeetingId === meeting.id ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-sky-100'}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">{meeting.title}</h4>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold bg-sky-100 text-sky-700 border-sky-200">
                            {formatPlatformName(meeting.platform)}
                          </span>
                          {meeting.recurrence === 'weekly' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold bg-emerald-100 text-emerald-700 border-emerald-200">
                              Weekly
                            </span>
                          )}
                          {meeting.recurrence === 'biweekly' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200">
                              Once in 2 weeks
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-700 mb-3">{truncate(meeting.description, 220)}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          <p><span className="font-semibold">Topic:</span> {meeting.topic}</p>
                          <p><span className="font-semibold">Speaker:</span> {meeting.speakerName}</p>
                          <p><span className="font-semibold">When:</span> {formatMeetingWhen(meeting.scheduledAt, meeting.timezone)} ({meeting.timezone})</p>
                          <p><span className="font-semibold">Duration:</span> {meeting.durationMinutes} min</p>
                          <p><span className="font-semibold">RSVP:</span> {meeting.attendees}{meeting.maxCapacity ? ` / ${meeting.maxCapacity}` : ''}</p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                            Attending: {meeting.attendees}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">
                            Not Attending: {meeting.declinedCount || 0}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
                            Join Clicks: {meeting.joinClickCount || 0}
                          </span>
                        </div>

                        {Array.isArray(meeting.notesLinks) && meeting.notesLinks.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {meeting.notesLinks.slice(0, 3).map((link) => (
                              <a
                                key={link}
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-full px-3 py-1 hover:bg-cyan-100"
                              >
                                Notes
                                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                              </a>
                            ))}
                          </div>
                        )}

                        {meeting.attachment?.url && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => void downloadMeetingAttachment(meeting)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 hover:bg-blue-100"
                            >
                              Download Material
                              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 w-full md:w-44">
                        {meeting.meetingUrl ? (
                          <button
                            type="button"
                            onClick={() => handleJoinMeetingClick(meeting)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-sky-600 text-white px-3 py-2 hover:bg-sky-700"
                          >
                            <VideoCameraIcon className="h-4 w-4" />
                            Join Meeting
                          </button>
                        ) : (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            {meeting.meetingId
                              ? `Meeting ID: ${meeting.meetingId}${meeting.passcode ? ` · Passcode: ${meeting.passcode}` : ''}`
                              : 'Join link not added yet'}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => copyMeetingDetails(meeting)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white text-slate-700 border border-slate-200 px-3 py-2 hover:bg-slate-50"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4" />
                          Copy Details
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShareMeeting(meeting)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white text-violet-700 border border-violet-200 px-3 py-2 hover:bg-violet-50"
                        >
                          <ShareIcon className="h-4 w-4" />
                          Share Link
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShareMeetingWhatsApp(meeting)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-green-600 text-white px-3 py-2 hover:bg-green-700"
                        >
                          WhatsApp
                        </button>

                        <button
                          type="button"
                          disabled={rsvpLoadingMeetingId === meeting.id}
                          onClick={() => handleMeetingRsvpJoin(meeting)}
                          className={`rounded-md px-3 py-2 text-white ${meeting.responseStatus === 'joined' ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-60`}
                        >
                          {rsvpLoadingMeetingId === meeting.id
                            ? 'Updating...'
                            : meeting.responseStatus === 'joined'
                              ? 'Leave RSVP'
                              : 'RSVP Join'}
                        </button>

                        <button
                          type="button"
                          disabled={rsvpLoadingMeetingId === meeting.id}
                          onClick={() => openDeclineModal(meeting)}
                          className={`rounded-md border px-3 py-2 ${meeting.responseStatus === 'not_going' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'} disabled:opacity-60`}
                        >
                          {meeting.responseStatus === 'not_going' ? 'Edit Not Attending' : 'Not Attending'}
                        </button>

                        {isAdminOrManager && (
                          <>
                            <button
                              type="button"
                              onClick={() => openMeetingResponsesViewer(meeting)}
                              className="rounded-md bg-cyan-600 text-white px-3 py-2 hover:bg-cyan-700"
                            >
                              View Responses
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditMeetingModal(meeting)}
                              className="rounded-md bg-amber-500 text-white px-3 py-2 hover:bg-amber-600"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={cancelingMeetingId === meeting.id}
                              onClick={() => handleCancelMeeting(meeting)}
                              className="rounded-md bg-rose-600 text-white px-3 py-2 hover:bg-rose-700 disabled:opacity-60"
                            >
                              {cancelingMeetingId === meeting.id ? 'Canceling...' : 'Cancel'}
                            </button>
                            <button
                              type="button"
                              disabled={sendingMeetingNotification === meeting.id}
                              onClick={() => sendMeetingNotificationNow(meeting, 'all_registered')}
                              className="rounded-md bg-violet-600 text-white px-3 py-2 hover:bg-violet-700 disabled:opacity-60"
                            >
                              {sendingMeetingNotification === meeting.id ? 'Sending...' : 'Send Now All'}
                            </button>
                            <button
                              type="button"
                              disabled={sendingMeetingNotification === meeting.id}
                              onClick={() => sendMeetingNotificationNow(meeting, 'rsvped_only')}
                              className="rounded-md bg-indigo-600 text-white px-3 py-2 hover:bg-indigo-700 disabled:opacity-60"
                            >
                              RSVP Only
                            </button>
                            {isSuperAdmin && (
                              <button
                                type="button"
                                disabled={deletingMeetingId === meeting.id}
                                onClick={() => handlePermanentDeleteMeeting(meeting)}
                                className="rounded-md bg-rose-700 text-white px-3 py-2 hover:bg-rose-800 disabled:opacity-60"
                              >
                                {deletingMeetingId === meeting.id ? 'Deleting...' : 'Delete Permanently'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {getAuthHeaders() && !loadingMeetings && pastMeetings.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Past and Closed Meetings</h3>
                {pastMeetings.slice(0, 8).map((meeting) => (
                  <div id={`meeting-card-${meeting.id}`} key={meeting.id} className="rounded-2xl border border-white bg-white/95 p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{meeting.title}</p>
                        <p className="text-sm text-gray-600">{meeting.topic} • {formatMeetingWhen(meeting.scheduledAt, meeting.timezone)}</p>
                        {meeting.attachment?.url && (
                          <button
                            type="button"
                            onClick={() => void downloadMeetingAttachment(meeting)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 hover:bg-blue-100"
                          >
                            Download Material
                          </button>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">Attending {meeting.attendees}</span>
                          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">Not Attending {meeting.declinedCount || 0}</span>
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700">Join Clicks {meeting.joinClickCount || 0}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleShareMeeting(meeting)}
                            className="inline-flex items-center gap-1 text-xs text-violet-700 border border-violet-200 rounded-full px-2.5 py-1 hover:bg-violet-50"
                          >
                            <ShareIcon className="h-3.5 w-3.5" />
                            Share
                          </button>
                          {isAdminOrManager && (
                            <button
                              type="button"
                              onClick={() => openMeetingResponsesViewer(meeting)}
                              className="inline-flex items-center gap-1 text-xs text-cyan-700 border border-cyan-200 rounded-full px-2.5 py-1 hover:bg-cyan-50"
                            >
                              View Responses
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              disabled={deletingMeetingId === meeting.id}
                              onClick={() => handlePermanentDeleteMeeting(meeting)}
                              className="inline-flex items-center gap-1 text-xs text-rose-700 border border-rose-200 rounded-full px-2.5 py-1 hover:bg-rose-50 disabled:opacity-60"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                              {deletingMeetingId === meeting.id ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${meeting.status === 'canceled' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {meeting.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Games Tab */}
        {activeTab === 'games' && (
          <IslamicGames />
        )}

        {/* Islamic Quote */}
        <div className="mt-12 rounded-2xl border border-white bg-white/90 p-6 text-center shadow-sm">
          <p className="text-lg font-arabic text-gray-700 mb-2">
            "وَالْمُؤْمِنُونَ وَالْمُؤْمِنَاتُ بَعْضُهُمْ أَوْلِيَاءُ بَعْضٍ"
          </p>
          <p className="text-sm text-gray-500 italic">
            "The believing men and believing women are allies of one another"
          </p>
          <p className="text-xs text-gray-400 mt-2">- Quran 9:71</p>
        </div>
      </div>

      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-lg font-bold text-gray-900">Not Attending Reason</h3>
              <button
                type="button"
                onClick={closeDeclineModal}
                className="rounded p-1 hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <p className="text-sm text-gray-600">
                {declineMeeting ? `Meeting: ${declineMeeting.title}` : 'Provide a reason for your response.'}
              </p>
              <textarea
                required
                rows={5}
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                placeholder="Required: briefly share why you cannot attend"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDeclineModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={submitMeetingDecline}
                  disabled={declineSubmitting}
                  className="rounded-md bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {declineSubmitting ? 'Saving...' : 'Save Not Attending'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMeetingResponsesModal && responseViewerMeeting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
          onClick={() => setShowMeetingResponsesModal(false)}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Meeting Responses</h3>
                <p className="text-sm text-gray-600">{responseViewerMeeting.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMeetingResponsesModal(false)}
                className="rounded p-1 hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <h4 className="text-sm font-semibold text-emerald-800">Attending (RSVP) ({responseViewerMeeting.rsvpedUsers?.length || 0})</h4>
                <div className="mt-2 space-y-1 text-sm text-emerald-900">
                  {(responseViewerMeeting.rsvpedUsers || []).length > 0 ? (
                    (responseViewerMeeting.rsvpedUsers || []).map((user) => (
                      <p key={`rsvp-${user.userId}`}>{user.name}</p>
                    ))
                  ) : (
                    <p className="text-emerald-700">No RSVP responses yet.</p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                <h4 className="text-sm font-semibold text-rose-800">Not Attending ({responseViewerMeeting.declinedUsers?.length || 0})</h4>
                <div className="mt-2 space-y-2 text-sm text-rose-900">
                  {(responseViewerMeeting.declinedUsers || []).length > 0 ? (
                    (responseViewerMeeting.declinedUsers || []).map((user) => (
                      <div key={`declined-${user.userId}`} className="rounded-md border border-rose-100 bg-white/70 p-2">
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-xs text-rose-700">{user.reason}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-rose-700">No decline responses yet.</p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
                <h4 className="text-sm font-semibold text-sky-800">Join Meeting Clicks ({responseViewerMeeting.joinClickUsers?.length || 0})</h4>
                <div className="mt-2 space-y-2 text-sm text-sky-900">
                  {(responseViewerMeeting.joinClickUsers || []).length > 0 ? (
                    (responseViewerMeeting.joinClickUsers || []).map((user) => (
                      <div key={`join-${user.userId}`} className="rounded-md border border-sky-100 bg-white/70 p-2">
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-xs text-sky-700">Clicks: {user.joinCount}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sky-700">No join clicks tracked yet.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

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
            setShowLocationSuggestions(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">Create Event</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateEventModal(false);
                  setShowLocationSuggestions(false);
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
                onFocus={() => setShowLocationSuggestions(true)}
                placeholder="Full location address"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />

              {showLocationSuggestions && (loadingLocationSuggestions || locationSuggestions.length > 0) && (
                <div className="rounded-md border border-gray-200 bg-white shadow-sm">
                  {loadingLocationSuggestions && (
                    <p className="px-3 py-2 text-sm text-gray-500">Searching locations...</p>
                  )}

                  {!loadingLocationSuggestions && locationSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.displayName}-${suggestion.lat}-${suggestion.lon}`}
                      type="button"
                      onClick={() => {
                        setAdminEventForm((prev) => ({
                          ...prev,
                          locationAddress: suggestion.displayName,
                          latitude: suggestion.lat,
                          longitude: suggestion.lon,
                        }));
                        setShowLocationSuggestions(false);
                      }}
                      className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-700 last:border-b-0 hover:bg-emerald-50"
                    >
                      {suggestion.displayName}
                    </button>
                  ))}
                </div>
              )}

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

      {showCreateMeetingModal && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">{editingMeetingId ? 'Edit Meeting' : 'Publish Meeting'}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateMeetingModal(false);
                  setEditingMeetingId(null);
                  setMeetingFieldErrors({});
                  setMeetingFormErrorSummary([]);
                }}
                className="p-1 rounded hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="p-4 space-y-4">
              {meetingFormErrorSummary.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <p className="font-semibold mb-1">Please fix these fields:</p>
                  <ul className="list-disc ml-5">
                    {meetingFormErrorSummary.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <input
                required
                value={adminMeetingForm.title}
                onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Meeting title"
                className={`w-full rounded-md px-3 py-2 ${meetingFieldErrors.title ? 'border border-red-400' : 'border border-gray-300'}`}
              />
              {meetingFieldErrors.title && <p className="text-xs text-red-600">{meetingFieldErrors.title}</p>}

              <textarea
                required
                value={adminMeetingForm.description}
                onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Meeting description"
                rows={4}
                className={`w-full rounded-md px-3 py-2 ${meetingFieldErrors.description ? 'border border-red-400' : 'border border-gray-300'}`}
              />
              {meetingFieldErrors.description && <p className="text-xs text-red-600">{meetingFieldErrors.description}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  required
                  value={adminMeetingForm.topic}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, topic: event.target.value }))}
                  placeholder="Topic (e.g., Surah Yasin Tafsir)"
                  className={`w-full rounded-md px-3 py-2 ${meetingFieldErrors.topic ? 'border border-red-400' : 'border border-gray-300'}`}
                />
                <input
                  required
                  value={adminMeetingForm.speakerName}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, speakerName: event.target.value }))}
                  placeholder="Speaker name"
                  className={`w-full rounded-md px-3 py-2 ${meetingFieldErrors.speakerName ? 'border border-red-400' : 'border border-gray-300'}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  required
                  value={adminMeetingForm.platform}
                  onChange={(event) => setAdminMeetingForm((prev) => ({
                    ...prev,
                    platform: event.target.value as AdminMeetingForm['platform'],
                  }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="google_meet">Google Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="jitsi">Jitsi</option>
                  <option value="other">Other</option>
                </select>

                <input
                  required
                  type="datetime-local"
                  value={adminMeetingForm.scheduledAt}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                  className={`w-full rounded-md px-3 py-2 ${meetingFieldErrors.scheduledAt ? 'border border-red-400' : 'border border-gray-300'}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  required
                  value={adminMeetingForm.durationMinutes}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                  placeholder="Duration (min)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <input
                  required
                  value={adminMeetingForm.timezone}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, timezone: event.target.value }))}
                  placeholder="Timezone"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <select
                  value={adminMeetingForm.recurrence}
                  onChange={(event) => setAdminMeetingForm((prev) => ({
                    ...prev,
                    recurrence: event.target.value as AdminMeetingForm['recurrence'],
                  }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="none">One-time</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Once in 2 weeks</option>
                </select>
              </div>

              <input
                value={adminMeetingForm.meetingUrl}
                onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, meetingUrl: event.target.value }))}
                placeholder="Meeting URL (recommended)"
                className={`w-full rounded-md px-3 py-2 ${meetingFieldErrors.meetingUrl ? 'border border-red-400' : 'border border-gray-300'}`}
              />
              {meetingFieldErrors.meetingUrl && <p className="text-xs text-red-600">{meetingFieldErrors.meetingUrl}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={adminMeetingForm.meetingId}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, meetingId: event.target.value }))}
                  placeholder="Meeting ID (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <input
                  value={adminMeetingForm.passcode}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, passcode: event.target.value }))}
                  placeholder="Passcode (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <input
                  value={adminMeetingForm.maxCapacity}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, maxCapacity: event.target.value }))}
                  placeholder="Max capacity (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={adminMeetingForm.tags}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="Tags comma-separated (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <input
                  value={adminMeetingForm.notesLinks}
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, notesLinks: event.target.value }))}
                  placeholder="Notes/material links comma-separated"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <p className="text-sm text-gray-700 mb-1">Attach Meeting Material (optional)</p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => setAdminMeetingForm((prev) => ({ ...prev, attachment: event.target.files?.[0] || null }))}
                  className={`w-full rounded-md px-3 py-2 text-sm ${meetingFieldErrors.attachment ? 'border border-red-400' : 'border border-gray-300'}`}
                />
                <p className="text-xs text-gray-500 mt-1">Allowed: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, WEBP. Max 10 MB.</p>
                {meetingFieldErrors.attachment && <p className="text-xs text-red-600">{meetingFieldErrors.attachment}</p>}
              </div>

              <button type="submit" disabled={creatingMeeting} className="w-full bg-sky-600 text-white py-2.5 rounded-md hover:bg-sky-700 disabled:opacity-60">
                {creatingMeeting ? (editingMeetingId ? 'Updating Meeting...' : 'Publishing Meeting...') : (editingMeetingId ? 'Update Meeting' : 'Publish Meeting')}
              </button>
            </form>
          </div>
        </div>
      )}

      {showMeetingNotificationModal && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowMeetingNotificationModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">Meeting Notification Settings</h3>
              <button
                type="button"
                onClick={() => setShowMeetingNotificationModal(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {!meetingNotificationSettings && (
              <div className="p-6 text-sm text-gray-600">Loading settings...</div>
            )}

            {meetingNotificationSettings && (
              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                  <p className="text-sm font-semibold text-violet-800">Advanced Reminder Engine</p>
                  <p className="text-xs text-violet-700">Configure default channels, lead times, one-time vs multiple sends, and branded email template for all registered users.</p>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={meetingNotificationSettings.defaults.enabled}
                    onChange={(event) => setMeetingNotificationSettings((prev) => prev ? {
                      ...prev,
                      defaults: { ...prev.defaults, enabled: event.target.checked },
                    } : prev)}
                    className="rounded border-gray-300"
                  />
                  Enable meeting reminders globally
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={meetingNotificationSettings.defaults.mode}
                    onChange={(event) => setMeetingNotificationSettings((prev) => prev ? {
                      ...prev,
                      defaults: { ...prev.defaults, mode: event.target.value as 'once' | 'multiple' },
                    } : prev)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="multiple">Send multiple reminders</option>
                    <option value="once">Send only once</option>
                  </select>

                  <select
                    value={meetingNotificationSettings.defaults.audience}
                    onChange={(event) => setMeetingNotificationSettings((prev) => prev ? {
                      ...prev,
                      defaults: { ...prev.defaults, audience: event.target.value as 'all_registered' | 'rsvped_only' },
                    } : prev)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="all_registered">Audience: all registered users</option>
                    <option value="rsvped_only">Audience: RSVP users only</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={meetingNotificationSettings.defaults.reminderMinutes.join(', ')}
                    onChange={(event) => {
                      const minutes = event.target.value
                        .split(',')
                        .map((item) => Number(item.trim()))
                        .filter((item) => Number.isFinite(item) && item > 0)
                        .sort((a, b) => b - a);
                      setMeetingNotificationSettings((prev) => prev ? {
                        ...prev,
                        defaults: { ...prev.defaults, reminderMinutes: minutes },
                      } : prev);
                    }}
                    placeholder="Reminder minutes e.g. 1440,60,15"
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                  <input
                    value={meetingNotificationSettings.defaults.channels.join(', ')}
                    onChange={(event) => {
                      const channels = event.target.value
                        .split(',')
                        .map((item) => item.trim().toLowerCase())
                        .filter((item) => item === 'push' || item === 'email') as Array<'push' | 'email'>;
                      setMeetingNotificationSettings((prev) => prev ? {
                        ...prev,
                        defaults: { ...prev.defaults, channels },
                      } : prev);
                    }}
                    placeholder="Channels: push,email"
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={meetingNotificationSettings.emailTemplate.subjectPrefix}
                    onChange={(event) => setMeetingNotificationSettings((prev) => prev ? {
                      ...prev,
                      emailTemplate: { ...prev.emailTemplate, subjectPrefix: event.target.value },
                    } : prev)}
                    placeholder="Email subject prefix"
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                  <input
                    value={meetingNotificationSettings.emailTemplate.logoUrl}
                    onChange={(event) => setMeetingNotificationSettings((prev) => prev ? {
                      ...prev,
                      emailTemplate: { ...prev.emailTemplate, logoUrl: event.target.value },
                    } : prev)}
                    placeholder="Logo URL"
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>

                <input
                  value={meetingNotificationSettings.emailTemplate.headerTitle}
                  onChange={(event) => setMeetingNotificationSettings((prev) => prev ? {
                    ...prev,
                    emailTemplate: { ...prev.emailTemplate, headerTitle: event.target.value },
                  } : prev)}
                  placeholder="Email header title"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />

                <textarea
                  value={meetingNotificationSettings.emailTemplate.footerText}
                  onChange={(event) => setMeetingNotificationSettings((prev) => prev ? {
                    ...prev,
                    emailTemplate: { ...prev.emailTemplate, footerText: event.target.value },
                  } : prev)}
                  placeholder="Footer text"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={meetingNotificationSettings.emailTemplate.includeAdvertisement}
                    onChange={(event) => setMeetingNotificationSettings((prev) => prev ? {
                      ...prev,
                      emailTemplate: { ...prev.emailTemplate, includeAdvertisement: event.target.checked },
                    } : prev)}
                    className="rounded border-gray-300"
                  />
                  Include advertisement text in invites
                </label>

                {meetingNotificationSettings.emailTemplate.includeAdvertisement && (
                  <textarea
                    value={meetingNotificationSettings.emailTemplate.advertisementText || ''}
                    onChange={(event) => setMeetingNotificationSettings((prev) => prev ? {
                      ...prev,
                      emailTemplate: { ...prev.emailTemplate, advertisementText: event.target.value },
                    } : prev)}
                    placeholder="Advertisement message (optional)"
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                )}

                <button
                  type="button"
                  onClick={saveMeetingNotificationSettings}
                  disabled={savingMeetingNotificationSettings}
                  className="w-full bg-violet-600 text-white py-2.5 rounded-md hover:bg-violet-700 disabled:opacity-60"
                >
                  {savingMeetingNotificationSettings ? 'Saving...' : 'Save Notification Settings'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default Community;
