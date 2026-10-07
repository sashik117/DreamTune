export class MediaController {
  constructor(mediaService, exportService) {
    this.mediaService = mediaService;
    this.exportService = exportService;
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

  previewYouTube = async (req, res) => {
    await this.mediaService.previewYouTube(req, res);
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

  exportMp3 = async (req, res) => {
    await this.exportService.exportMp3(req, res);
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
