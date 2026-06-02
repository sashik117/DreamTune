import express from 'express';
import { asyncHandler } from '../shared/controller.js';
import { SocialController } from './social.controller.js';
import { SocialService } from './social.service.js';

export function createSocialRouter(dependencies) {
  const router = express.Router();
  const controller = new SocialController(new SocialService(dependencies));

  router.get('/api/friends', asyncHandler(controller.listFriends));
  router.get('/api/friends/requests', asyncHandler(controller.listRequests));
  router.get('/api/friends/requests/count', asyncHandler(controller.countRequests));
  router.post('/api/friends/request', asyncHandler(controller.requestFriend));
  router.post('/api/friends/requests/:id/accept', asyncHandler(controller.acceptFriendRequest));
  router.post('/api/friends/requests/:id/decline', asyncHandler(controller.declineFriendRequest));
  router.delete('/api/friends/:id', asyncHandler(controller.removeFriend));

  router.post('/api/collab-playlists/:id/invite', asyncHandler(controller.inviteToCollabPlaylist));
  router.get('/api/collab-playlists/:id/songs', asyncHandler(controller.listCollabPlaylistSongs));
  router.post('/api/collab-invites/:id/accept', asyncHandler(controller.acceptCollabInvite));
  router.post('/api/collab-invites/:id/decline', asyncHandler(controller.declineCollabInvite));

  router.post('/api/share/song', asyncHandler(controller.shareSong));

  return router;
}
