export class SocialController {
  constructor(socialService) {
    this.socialService = socialService;
  }

  listFriends = async (req, res) => {
    res.json(await this.socialService.listFriends(req));
  };

  listRequests = async (req, res) => {
    res.json(await this.socialService.listRequests(req));
  };

  countRequests = async (req, res) => {
    res.json(await this.socialService.countRequests(req));
  };

  requestFriend = async (req, res) => {
    const result = await this.socialService.requestFriend(req);
    res.status(result.status || 200).json(result.body || result);
  };

  acceptFriendRequest = async (req, res) => {
    res.json(await this.socialService.acceptFriendRequest(req));
  };

  declineFriendRequest = async (req, res) => {
    res.json(await this.socialService.declineFriendRequest(req));
  };

  inviteToCollabPlaylist = async (req, res) => {
    const result = await this.socialService.inviteToCollabPlaylist(req);
    res.status(result.status || 200).json(result.body || result);
  };

  acceptCollabInvite = async (req, res) => {
    res.json(await this.socialService.acceptCollabInvite(req));
  };

  declineCollabInvite = async (req, res) => {
    res.json(await this.socialService.declineCollabInvite(req));
  };

  removeFriend = async (req, res) => {
    res.json(await this.socialService.removeFriend(req));
  };

  shareSong = async (req, res) => {
    const result = await this.socialService.shareSong(req);
    res.status(201).json(result);
  };

  listCollabPlaylistSongs = async (req, res) => {
    res.json(await this.socialService.listCollabPlaylistSongs(req));
  };
}
