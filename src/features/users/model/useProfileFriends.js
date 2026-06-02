import { useCallback, useEffect, useState } from 'react';
import { social } from '@/api/SupabaseClient';
import { toast } from 'sonner';

export function useProfileFriends({ active = false, onFriendRequestsViewed, onFriendRequestCountRefresh }) {
  const [friendQuery, setFriendQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [friendSearchDone, setFriendSearchDone] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);

  const loadFriends = useCallback(async () => {
    try {
      const [friendList, requestList] = await Promise.all([
        social.listFriends(),
        social.listFriendRequests(),
      ]);
      setFriends(friendList);
      setFriendRequests(requestList);
      if (requestList.length) onFriendRequestsViewed?.();
    } catch (error) {
      console.error(error);
    }
  }, [onFriendRequestsViewed]);

  useEffect(() => {
    if (!active) return;
    loadFriends();
  }, [active, loadFriends]);

  useEffect(() => {
    if (!active) return undefined;
    const query = friendQuery.trim();
    if (query.length < 2) {
      setUserResults([]);
      setFriendSearchDone(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      social.searchUsers(query)
        .then(results => {
          setUserResults(results.filter(user => user.relationship !== 'friend'));
          setFriendSearchDone(true);
        })
        .catch(() => {
          setUserResults([]);
          setFriendSearchDone(true);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [active, friendQuery]);

  const addFriend = useCallback(async () => {
    const nickname = friendQuery.trim().replace(/^@/, '');
    if (!nickname) return;
    if (friends.some(friend => friend.nickname.toLowerCase() === nickname.toLowerCase())) {
      setFriendQuery('');
      setUserResults([]);
      setFriendSearchDone(false);
      return;
    }
    try {
      const result = await social.requestFriend({ nickname });
      setFriendQuery('');
      if (result.accepted || result.already_friends) {
        toast.success(`@${nickname} added to friends`);
        loadFriends();
        onFriendRequestCountRefresh?.();
      } else {
        toast.success(`Request sent to @${nickname}`);
      }
    } catch (error) {
      toast.error(error.message === 'User not found' ? 'User not found' : error.message || 'Could not send request');
    }
  }, [friendQuery, friends, loadFriends, onFriendRequestCountRefresh]);

  const requestFriendById = useCallback(async (user) => {
    try {
      await social.requestFriend({ friend_id: user.id });
      setUserResults(prev => prev.map(item => item.id === user.id ? { ...item, relationship: 'pending' } : item));
      toast.success(`Request sent to @${user.nickname}`);
    } catch (error) {
      toast.error(error.message || 'Could not send request');
    }
  }, []);

  const acceptFriend = useCallback(async (requestId) => {
    try {
      await social.acceptFriendRequest(requestId);
      toast.success('Request accepted');
      loadFriends();
      onFriendRequestCountRefresh?.();
    } catch (error) {
      toast.error(error.message || 'Could not accept request');
    }
  }, [loadFriends, onFriendRequestCountRefresh]);

  const declineFriend = useCallback(async (requestId) => {
    try {
      await social.declineFriendRequest(requestId);
      setFriendRequests(prev => prev.filter(request => request.id !== requestId));
      toast.success('Request declined');
      onFriendRequestCountRefresh?.();
    } catch (error) {
      toast.error(error.message || 'Could not decline request');
    }
  }, [onFriendRequestCountRefresh]);

  const acceptCollabInvite = useCallback(async (requestId) => {
    try {
      await social.acceptCollabInvite(requestId);
      toast.success('Playlist invitation accepted');
      loadFriends();
      onFriendRequestCountRefresh?.();
    } catch (error) {
      toast.error(error.message || 'Could not accept invitation');
    }
  }, [loadFriends, onFriendRequestCountRefresh]);

  const declineCollabInvite = useCallback(async (requestId) => {
    try {
      await social.declineCollabInvite(requestId);
      setFriendRequests(prev => prev.filter(request => request.id !== requestId));
      toast.success('Invitation declined');
      onFriendRequestCountRefresh?.();
    } catch (error) {
      toast.error(error.message || 'Could not decline invitation');
    }
  }, [onFriendRequestCountRefresh]);

  const removeFriend = useCallback(async (friend) => {
    if (!friend?.id) return;
    const ok = window.confirm(`Remove @${friend.nickname} from friends?`);
    if (!ok) return;
    try {
      await social.removeFriend(friend.id);
      setFriends(prev => prev.filter(item => item.id !== friend.id));
      setUserResults(prev => prev.map(item => item.id === friend.id ? { ...item, relationship: 'none' } : item));
      toast.success('Friend removed');
    } catch (error) {
      toast.error(error.message || 'Could not remove friend');
    }
  }, []);

  const clearFriends = useCallback(() => {
    setFriends([]);
    setFriendRequests([]);
    setUserResults([]);
    setFriendSearchDone(false);
  }, []);

  return {
    acceptCollabInvite,
    acceptFriend,
    addFriend,
    clearFriends,
    declineCollabInvite,
    declineFriend,
    friendQuery,
    friendRequests,
    friendSearchDone,
    friends,
    loadFriends,
    removeFriend,
    requestFriendById,
    setFriendQuery,
    userResults,
  };
}
