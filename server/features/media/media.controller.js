export class MediaController {
  constructor(mediaService) {
    this.mediaService = mediaService;
  }

  globalChart = async (req, res) => {
    res.json(await this.mediaService.globalChart(req));
  };

  searchYouTube = async (req, res) => {
    res.json(await this.mediaService.searchYouTube(req));
  };

  downloadYouTube = async (req, res) => {
    res.json(await this.mediaService.downloadYouTube(req));
  };

  spotifyPlaylist = async (req, res) => {
    res.json(await this.mediaService.spotifyPlaylist(req));
  };

  spotifySearch = async (req, res) => {
    res.json(await this.mediaService.spotifySearch(req));
  };

  spotifyCover = async (req, res) => {
    res.json(await this.mediaService.spotifyCover(req));
  };

  spotifyChart = async (req, res) => {
    res.json(await this.mediaService.spotifyChart(req));
  };

  lyrics = async (req, res) => {
    try {
      res.json(await this.mediaService.lyrics(req));
    } catch (error) {
      if (error.status === 404 && Object.prototype.hasOwnProperty.call(error, 'lyrics')) {
        return res.status(404).json({ error: error.message, lyrics: error.lyrics });
      }
      throw error;
    }
  };
}
